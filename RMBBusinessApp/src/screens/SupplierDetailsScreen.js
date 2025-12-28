import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
} from 'firebase/firestore';

import { db } from '../config/firebase';
import styles from '../styles/styles';
import { formatUSD } from '../utils/format';
import { getTodayDate } from '../utils/date';

import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

export default function SupplierDetailsScreen({ route }) {
  const { supplier } = route.params;

  const [supplierData, setSupplierData] = useState(supplier);
  const [transactions, setTransactions] = useState([]);

  const [billModalVisible, setBillModalVisible] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);

  const [newRMBBill, setNewRMBBill] = useState({
    rmbAmount: '',
    rate: '',
    description: '',
    date: getTodayDate(),
  });

  const [newUSDTBill, setNewUSDTBill] = useState({
    bdtAmount: '',
    rate: '',
    description: '',
    date: getTodayDate(),
  });

  const [newPayment, setNewPayment] = useState({
    amountUSD: '',
    description: '',
    date: getTodayDate(),
  });

  const [editingTransaction, setEditingTransaction] = useState({
    id: '',
    type: '',
    supplierType: '',
    rmbAmount: '',
    bdtAmount: '',
    rate: '',
    amountUSD: '',
    description: '',
    calculation: '',
    date: getTodayDate(),
    timestamp: '',
  });

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTransactions = async () => {
    try {
      const transactionsRef = collection(db, `suppliers/${supplier.id}/transactions`);
      const querySnapshot = await getDocs(transactionsRef);

      const list = [];
      querySnapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));

      list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setTransactions(list);

      await AsyncStorage.setItem(`supplier_transactions_${supplier.id}`, JSON.stringify(list));
    } catch (error) {
      console.error('Error loading transactions from Firestore:', error);

      const stored = await AsyncStorage.getItem(`supplier_transactions_${supplier.id}`);
      if (stored) {
        const list = JSON.parse(stored);
        list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setTransactions(list);
      }
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTransactions();
    setRefreshing(false);
  };

  const handleLocalSave = async (type, data, isEdit = false) => {
    const newTransaction = {
      id: isEdit ? editingTransaction.id : Date.now().toString(),
      supplierId: supplier.id,
      supplierName: supplier.name,
      supplierType: supplier.type,
      type,
      ...data,
      date: data.date || getTodayDate(),
      timestamp: isEdit ? (editingTransaction.timestamp || new Date().toISOString()) : new Date().toISOString(),
    };

    if (!isEdit) newTransaction.createdAt = getTodayDate();

    let updatedTransactions;
    if (isEdit) {
      updatedTransactions = transactions.map((t) => (t.id === editingTransaction.id ? newTransaction : t));
    } else {
      updatedTransactions = [newTransaction, ...transactions];
    }

    updatedTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    setTransactions(updatedTransactions);
    await AsyncStorage.setItem(`supplier_transactions_${supplier.id}`, JSON.stringify(updatedTransactions));

    let balanceChange = 0;
    if (type === 'bill') balanceChange = data.amountUSD || 0;
    if (type === 'payment') balanceChange = -(data.amountUSD || 0);

    const currentBalance = parseFloat(supplierData.balanceUSD) || 0;
    const newBalance = currentBalance + balanceChange;

    const updatedSupplier = { ...supplierData, balanceUSD: newBalance };
    setSupplierData(updatedSupplier);

    const storedSuppliers = await AsyncStorage.getItem('suppliers');
    if (storedSuppliers) {
      const suppliersList = JSON.parse(storedSuppliers);
      const updatedSuppliers = suppliersList.map((s) => (s.id === supplier.id ? updatedSupplier : s));
      await AsyncStorage.setItem('suppliers', JSON.stringify(updatedSuppliers));
    }

    Alert.alert('Saved locally', `${isEdit ? 'Transaction updated' : 'Transaction saved'} to device`);

    if (type === 'bill') {
      setBillModalVisible(false);
      if (supplier.type === 'RMB') setNewRMBBill({ rmbAmount: '', rate: '', description: '', date: getTodayDate() });
      else setNewUSDTBill({ bdtAmount: '', rate: '', description: '', date: getTodayDate() });
    } else {
      setPaymentModalVisible(false);
      setNewPayment({ amountUSD: '', description: '', date: getTodayDate() });
    }

    if (isEdit) {
      setEditModalVisible(false);
      setEditingTransaction({
        id: '',
        type: '',
        supplierType: '',
        rmbAmount: '',
        bdtAmount: '',
        rate: '',
        amountUSD: '',
        description: '',
        calculation: '',
        date: getTodayDate(),
        timestamp: '',
      });
    }
  };

  const saveTransaction = async (type, data, isEdit = false) => {
    try {
      const newTransaction = {
        supplierId: supplier.id,
        supplierName: supplier.name,
        supplierType: supplier.type,
        type,
        ...data,
        date: data.date || getTodayDate(),
        timestamp: isEdit ? (editingTransaction.timestamp || new Date().toISOString()) : new Date().toISOString(),
      };

      Object.keys(newTransaction).forEach((k) => newTransaction[k] === undefined && delete newTransaction[k]);

      let balanceChange = 0;
      if (type === 'bill') balanceChange = data.amountUSD || 0;
      if (type === 'payment') balanceChange = -(data.amountUSD || 0);

      const currentBalanceUSD = parseFloat(supplierData.balanceUSD) || 0;

      if (isEdit && editingTransaction.id) {
        const oldTx = transactions.find((t) => t.id === editingTransaction.id);
        let oldReverse = 0;

        if (oldTx?.type === 'bill') oldReverse = -(oldTx.amountUSD || 0);
        if (oldTx?.type === 'payment') oldReverse = oldTx.amountUSD || 0;

        const afterReverse = currentBalanceUSD + oldReverse;
        const finalBalance = afterReverse + balanceChange;

        const updateData = { ...newTransaction };
        delete updateData.id;
        delete updateData.createdAt;

        await updateDoc(doc(db, `suppliers/${supplier.id}/transactions`, editingTransaction.id), updateData);

        const updatedTransactions = transactions
          .map((t) => (t.id === editingTransaction.id ? { ...t, ...newTransaction } : t))
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setTransactions(updatedTransactions);
        await AsyncStorage.setItem(`supplier_transactions_${supplier.id}`, JSON.stringify(updatedTransactions));

        const updatedSupplier = { ...supplierData, balanceUSD: finalBalance };
        setSupplierData(updatedSupplier);

        await updateDoc(doc(db, 'suppliers', supplier.id), { balanceUSD: finalBalance, updatedAt: getTodayDate() });

        const storedSuppliers = await AsyncStorage.getItem('suppliers');
        if (storedSuppliers) {
          const suppliersList = JSON.parse(storedSuppliers);
          const updatedSuppliers = suppliersList.map((s) => (s.id === supplier.id ? updatedSupplier : s));
          await AsyncStorage.setItem('suppliers', JSON.stringify(updatedSuppliers));
        }
      } else {
        newTransaction.createdAt = getTodayDate();

        const docRef = await addDoc(collection(db, `suppliers/${supplier.id}/transactions`), newTransaction);
        const tx = { id: docRef.id, ...newTransaction };

        const updatedTransactions = [tx, ...transactions].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setTransactions(updatedTransactions);
        await AsyncStorage.setItem(`supplier_transactions_${supplier.id}`, JSON.stringify(updatedTransactions));

        const newBalanceUSD = currentBalanceUSD + balanceChange;
        const updatedSupplier = { ...supplierData, balanceUSD: newBalanceUSD };
        setSupplierData(updatedSupplier);

        await updateDoc(doc(db, 'suppliers', supplier.id), { balanceUSD: newBalanceUSD, updatedAt: getTodayDate() });

        const storedSuppliers = await AsyncStorage.getItem('suppliers');
        if (storedSuppliers) {
          const suppliersList = JSON.parse(storedSuppliers);
          const updatedSuppliers = suppliersList.map((s) => (s.id === supplier.id ? updatedSupplier : s));
          await AsyncStorage.setItem('suppliers', JSON.stringify(updatedSuppliers));
        }
      }

      Alert.alert('Success', `${isEdit ? 'Transaction updated' : 'Transaction saved'} to cloud!`);

      if (type === 'bill') {
        setBillModalVisible(false);
        if (supplier.type === 'RMB') setNewRMBBill({ rmbAmount: '', rate: '', description: '', date: getTodayDate() });
        else setNewUSDTBill({ bdtAmount: '', rate: '', description: '', date: getTodayDate() });
      } else {
        setPaymentModalVisible(false);
        setNewPayment({ amountUSD: '', description: '', date: getTodayDate() });
      }

      if (isEdit) {
        setEditModalVisible(false);
        setEditingTransaction({
          id: '',
          type: '',
          supplierType: '',
          rmbAmount: '',
          bdtAmount: '',
          rate: '',
          amountUSD: '',
          description: '',
          calculation: '',
          date: getTodayDate(),
          timestamp: '',
        });
      }
    } catch (error) {
      console.error('Error saving transaction:', error);
      Alert.alert('Error', `Failed to save: ${error.message}`);
      handleLocalSave(type, data, isEdit);
    }
  };

  const handleNewBill = () => {
    if (supplierData.type === 'RMB') {
      if (!newRMBBill.rmbAmount || !newRMBBill.rate) {
        Alert.alert('Error', 'Please enter RMB amount and rate');
        return;
      }

      const rmbAmount = parseFloat(newRMBBill.rmbAmount) || 0;
      const rate = parseFloat(newRMBBill.rate) || 0;
      const amountUSD = rate > 0 ? rmbAmount / rate : 0;

      saveTransaction('bill', {
        ...newRMBBill,
        rmbAmount,
        rate,
        amountUSD,
        calculation: `${rmbAmount} RMB / ${rate} = ${amountUSD.toFixed(2)} USD`,
      });
    } else {
      if (!newUSDTBill.bdtAmount || !newUSDTBill.rate) {
        Alert.alert('Error', 'Please enter BDT amount and rate');
        return;
      }

      const bdtAmount = parseFloat(newUSDTBill.bdtAmount) || 0;
      const rate = parseFloat(newUSDTBill.rate) || 0;
      const amountUSD = rate > 0 ? bdtAmount / rate : 0;

      saveTransaction('bill', {
        ...newUSDTBill,
        bdtAmount,
        rate,
        amountUSD,
        calculation: `${bdtAmount} BDT / ${rate} = ${amountUSD.toFixed(2)} USD`,
      });
    }
  };

  const handlePayment = () => {
    if (!newPayment.amountUSD) {
      Alert.alert('Error', 'Please enter payment amount in USD');
      return;
    }

    saveTransaction('payment', {
      ...newPayment,
      amountUSD: parseFloat(newPayment.amountUSD) || 0,
    });
  };

  const handleUpdateTransaction = () => {
    if (editingTransaction.type === 'bill') {
      if (editingTransaction.supplierType === 'RMB') {
        if (!editingTransaction.rmbAmount || !editingTransaction.rate) {
          Alert.alert('Error', 'Please enter RMB amount and rate');
          return;
        }

        const rmbAmount = parseFloat(editingTransaction.rmbAmount) || 0;
        const rate = parseFloat(editingTransaction.rate) || 0;
        const amountUSD = rate > 0 ? rmbAmount / rate : 0;

        saveTransaction(
          'bill',
          {
            rmbAmount,
            rate,
            amountUSD,
            calculation: `${rmbAmount} RMB / ${rate} = ${amountUSD.toFixed(2)} USD`,
            description: editingTransaction.description,
            date: editingTransaction.date,
          },
          true
        );
      } else {
        if (!editingTransaction.bdtAmount || !editingTransaction.rate) {
          Alert.alert('Error', 'Please enter BDT amount and rate');
          return;
        }

        const bdtAmount = parseFloat(editingTransaction.bdtAmount) || 0;
        const rate = parseFloat(editingTransaction.rate) || 0;
        const amountUSD = rate > 0 ? bdtAmount / rate : 0;

        saveTransaction(
          'bill',
          {
            bdtAmount,
            rate,
            amountUSD,
            calculation: `${bdtAmount} BDT / ${rate} = ${amountUSD.toFixed(2)} USD`,
            description: editingTransaction.description,
            date: editingTransaction.date,
          },
          true
        );
      }
    } else {
      if (!editingTransaction.amountUSD) {
        Alert.alert('Error', 'Please enter payment amount in USD');
        return;
      }

      saveTransaction(
        'payment',
        {
          amountUSD: parseFloat(editingTransaction.amountUSD) || 0,
          description: editingTransaction.description,
          date: editingTransaction.date,
        },
        true
      );
    }
  };

  const editTransaction = (transaction) => {
    setEditingTransaction({
      id: transaction.id,
      type: transaction.type,
      supplierType: supplier.type,
      rmbAmount: transaction.rmbAmount?.toString() || '',
      bdtAmount: transaction.bdtAmount?.toString() || '',
      rate: transaction.rate?.toString() || '',
      amountUSD: transaction.amountUSD?.toString() || '',
      description: transaction.description || '',
      calculation: transaction.calculation || '',
      date: transaction.date || getTodayDate(),
      timestamp: transaction.timestamp,
    });
    setEditModalVisible(true);
  };

  const deleteTransaction = (transactionId) => {
    Alert.alert('Delete Transaction', 'Are you sure you want to delete this transaction?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const tx = transactions.find((t) => t.id === transactionId);
            if (!tx) return;

            let reverse = 0;
            if (tx.type === 'bill') reverse = -(tx.amountUSD || 0);
            if (tx.type === 'payment') reverse = tx.amountUSD || 0;

            const currentBalance = parseFloat(supplierData.balanceUSD) || 0;
            const newBalance = currentBalance + reverse;

            await deleteDoc(doc(db, `suppliers/${supplier.id}/transactions`, transactionId));

            const updatedTransactions = transactions
              .filter((t) => t.id !== transactionId)
              .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            setTransactions(updatedTransactions);
            await AsyncStorage.setItem(`supplier_transactions_${supplier.id}`, JSON.stringify(updatedTransactions));

            const updatedSupplier = { ...supplierData, balanceUSD: newBalance };
            setSupplierData(updatedSupplier);

            await updateDoc(doc(db, 'suppliers', supplier.id), { balanceUSD: newBalance, updatedAt: getTodayDate() });

            const storedSuppliers = await AsyncStorage.getItem('suppliers');
            if (storedSuppliers) {
              const suppliersList = JSON.parse(storedSuppliers);
              const updatedSuppliers = suppliersList.map((s) => (s.id === supplier.id ? updatedSupplier : s));
              await AsyncStorage.setItem('suppliers', JSON.stringify(updatedSuppliers));
            }

            Alert.alert('Success', 'Transaction deleted from cloud!');
          } catch (error) {
            console.error('Error deleting transaction:', error);
            Alert.alert('Error', 'Failed to delete from cloud (try again)');
          }
        },
      },
    ]);
  };

  const TypeBadge = ({ type }) => {
    const isBill = type === 'bill';
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name={isBill ? 'receipt-text-outline' : 'cash-check'} size={16} color={isBill ? '#FF9500' : '#34C759'} />
        <Text style={styles.transactionTypeText}>{isBill ? 'BILL' : 'PAYMENT'}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.supplierHeader}>
        <Text style={styles.supplierName}>{supplierData.name}</Text>

        <Text
          style={[
            styles.supplierType,
            supplierData.type === 'RMB' ? styles.rmbType : styles.usdtType,
          ]}
        >
          {supplierData.type} Supplier
        </Text>

        {supplierData.contact ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="phone" size={14} color="#666" />
            <Text style={styles.supplierContact}>{supplierData.contact}</Text>
          </View>
        ) : null}

        <View
          style={[
            styles.balanceCard,
            supplierData.balanceUSD > 0
              ? styles.balanceOwe
              : supplierData.balanceUSD < 0
              ? styles.balanceReceive
              : styles.balanceNeutral,
          ]}
        >
          <Text style={styles.balanceTitle}>
            {supplierData.balanceUSD > 0
              ? 'You Owe Supplier'
              : supplierData.balanceUSD < 0
              ? 'Supplier Owes You'
              : 'Balance Settled'}
          </Text>

          <Text style={styles.balanceAmount}>{formatUSD(Math.abs(supplierData.balanceUSD))}</Text>

          <Text style={styles.transactionCount}>
            {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionButtons}>
        <TouchableOpacity style={[styles.actionButtonLarge, styles.billButton]} onPress={() => setBillModalVisible(true)}>
          <Icon name="receipt-text-outline" size={22} color="white" />
          <Text style={styles.actionButtonText}>
            New {supplierData.type === 'RMB' ? 'RMB' : 'USDT'} Bill
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButtonLarge, styles.paymentButton]} onPress={() => setPaymentModalVisible(true)}>
          <Icon name="cash-check" size={22} color="white" />
          <Text style={styles.actionButtonText}>Make Payment</Text>
        </TouchableOpacity>
      </View>

      {/* Transaction header */}
      <View style={styles.transactionHeader}>
        <Text style={styles.sectionTitle}>Transaction History</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Icon name="refresh" size={18} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        refreshing={refreshing}
        onRefresh={onRefresh}
        renderItem={({ item, index }) => (
          <TouchableOpacity style={styles.transactionCard} onPress={() => editTransaction(item)}>
            <View style={styles.transactionHeaderRow}>
              <View style={styles.transactionTypeBadge}>
                <TypeBadge type={item.type} />
                <Text style={styles.transactionIndex}>#{index + 1}</Text>
              </View>

              <View style={styles.transactionActions}>
                <TouchableOpacity style={styles.smallEditButton} onPress={() => editTransaction(item)}>
                  <Icon name="pencil" size={16} color="#007AFF" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.smallDeleteButton} onPress={() => deleteTransaction(item.id)}>
                  <Icon name="trash-can-outline" size={16} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="calendar" size={14} color="#666" />
              <Text style={styles.transactionDate}>
                {item.date} •{' '}
                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>

            {item.type === 'bill' ? (
              <View style={styles.transactionDetails}>
                {item.supplierType === 'RMB' ? (
                  <>
                    <View style={styles.transactionRow}>
                      <Text style={styles.transactionLabel}>RMB Amount:</Text>
                      <Text style={styles.transactionValue}>{item.rmbAmount}</Text>
                    </View>
                    <View style={styles.transactionRow}>
                      <Text style={styles.transactionLabel}>Rate:</Text>
                      <Text style={styles.transactionValue}>{item.rate} RMB/$</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.transactionRow}>
                      <Text style={styles.transactionLabel}>BDT Amount:</Text>
                      <Text style={styles.transactionValue}>{item.bdtAmount}</Text>
                    </View>
                    <View style={styles.transactionRow}>
                      <Text style={styles.transactionLabel}>Rate:</Text>
                      <Text style={styles.transactionValue}>{item.rate} BDT/$</Text>
                    </View>
                  </>
                )}

                <View style={styles.transactionRow}>
                  <Text style={styles.transactionLabel}>Bill Amount:</Text>
                  <Text style={[styles.transactionValue, styles.boldText]}>{formatUSD(item.amountUSD)}</Text>
                </View>

                {item.calculation ? (
                  <View style={styles.notesContainer}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Icon name="calculator-variant-outline" size={14} color="#666" />
                      <Text style={styles.notesLabel}>Calculation:</Text>
                    </View>
                    <Text style={styles.notesText}>{item.calculation}</Text>
                  </View>
                ) : null}

                {item.description ? (
                  <View style={styles.notesContainer}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Icon name="note-text-outline" size={14} color="#666" />
                      <Text style={styles.notesLabel}>Note:</Text>
                    </View>
                    <Text style={styles.notesText}>{item.description}</Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={styles.transactionDetails}>
                <View style={styles.transactionRow}>
                  <Text style={styles.transactionLabel}>Payment Amount:</Text>
                  <Text style={[styles.transactionValue, styles.boldText]}>{formatUSD(item.amountUSD)}</Text>
                </View>

                {item.description ? (
                  <View style={styles.notesContainer}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Icon name="note-text-outline" size={14} color="#666" />
                      <Text style={styles.notesLabel}>Note:</Text>
                    </View>
                    <Text style={styles.notesText}>{item.description}</Text>
                  </View>
                ) : null}
              </View>
            )}

            {item.createdAt ? <Text style={styles.transactionTime}>Added: {item.createdAt}</Text> : null}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyTransactionState}>
            <Icon name="receipt-text-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTransactionText}>No transactions yet</Text>
            <Text style={styles.emptyTransactionSubtext}>Add your first bill or payment</Text>
          </View>
        }
      />

      {/* New Bill Modal */}
      <Modal animationType="slide" transparent visible={billModalVisible} onRequestClose={() => setBillModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="receipt-text-outline" size={20} color="#FF9500" />
              <Text style={styles.modalTitle}>
                New {supplierData.type === 'RMB' ? 'RMB' : 'USDT'} Bill
              </Text>
            </View>

            {supplierData.type === 'RMB' ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="RMB Amount"
                  value={newRMBBill.rmbAmount}
                  onChangeText={(text) => setNewRMBBill({ ...newRMBBill, rmbAmount: text })}
                  keyboardType="numeric"
                />

                <TextInput
                  style={styles.input}
                  placeholder="Supplier Rate (RMB per $)"
                  value={newRMBBill.rate}
                  onChangeText={(text) => setNewRMBBill({ ...newRMBBill, rate: text })}
                  keyboardType="numeric"
                />

                {newRMBBill.rmbAmount && newRMBBill.rate ? (
                  <View style={styles.calculationBox}>
                    <Text style={styles.calculationText}>
                      Bill Amount: ${((parseFloat(newRMBBill.rmbAmount) || 0) / (parseFloat(newRMBBill.rate) || 1)).toFixed(2)}
                    </Text>
                    <Text style={styles.calculationFormula}>
                      {newRMBBill.rmbAmount} RMB ÷ {newRMBBill.rate} = ${((parseFloat(newRMBBill.rmbAmount) || 0) / (parseFloat(newRMBBill.rate) || 1)).toFixed(2)} USD
                    </Text>
                  </View>
                ) : null}
              </>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="BDT Amount"
                  value={newUSDTBill.bdtAmount}
                  onChangeText={(text) => setNewUSDTBill({ ...newUSDTBill, bdtAmount: text })}
                  keyboardType="numeric"
                />

                <TextInput
                  style={styles.input}
                  placeholder="Supplier Rate (BDT per $)"
                  value={newUSDTBill.rate}
                  onChangeText={(text) => setNewUSDTBill({ ...newUSDTBill, rate: text })}
                  keyboardType="numeric"
                />

                {newUSDTBill.bdtAmount && newUSDTBill.rate ? (
                  <View style={styles.calculationBox}>
                    <Text style={styles.calculationText}>
                      Bill Amount: ${((parseFloat(newUSDTBill.bdtAmount) || 0) / (parseFloat(newUSDTBill.rate) || 1)).toFixed(2)}
                    </Text>
                    <Text style={styles.calculationFormula}>
                      {newUSDTBill.bdtAmount} BDT ÷ {newUSDTBill.rate} = ${((parseFloat(newUSDTBill.bdtAmount) || 0) / (parseFloat(newUSDTBill.rate) || 1)).toFixed(2)} USD
                    </Text>
                  </View>
                ) : null}
              </>
            )}

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description (Optional)"
              value={supplierData.type === 'RMB' ? newRMBBill.description : newUSDTBill.description}
              onChangeText={(text) => {
                if (supplierData.type === 'RMB') setNewRMBBill({ ...newRMBBill, description: text });
                else setNewUSDTBill({ ...newUSDTBill, description: text });
              }}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setBillModalVisible(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleNewBill}>
                <Text style={styles.modalButtonText}>Save Bill</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Payment Modal */}
      <Modal animationType="slide" transparent visible={paymentModalVisible} onRequestClose={() => setPaymentModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="cash-check" size={20} color="#34C759" />
              <Text style={styles.modalTitle}>Make Payment to Supplier</Text>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Amount in USD"
              value={newPayment.amountUSD}
              onChangeText={(text) => setNewPayment({ ...newPayment, amountUSD: text })}
              keyboardType="numeric"
            />

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description (Optional)"
              value={newPayment.description}
              onChangeText={(text) => setNewPayment({ ...newPayment, description: text })}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setPaymentModalVisible(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handlePayment}>
                <Text style={styles.modalButtonText}>Save Payment</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Modal */}
      <Modal animationType="slide" transparent visible={editModalVisible} onRequestClose={() => setEditModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="pencil" size={20} color="#007AFF" />
              <Text style={styles.modalTitle}>Edit {editingTransaction.type === 'bill' ? 'Bill' : 'Payment'}</Text>
            </View>

            {editingTransaction.type === 'bill' ? (
              editingTransaction.supplierType === 'RMB' ? (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="RMB Amount"
                    value={editingTransaction.rmbAmount}
                    onChangeText={(text) => setEditingTransaction({ ...editingTransaction, rmbAmount: text })}
                    keyboardType="numeric"
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Supplier Rate (RMB per $)"
                    value={editingTransaction.rate}
                    onChangeText={(text) => setEditingTransaction({ ...editingTransaction, rate: text })}
                    keyboardType="numeric"
                  />
                </>
              ) : (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="BDT Amount"
                    value={editingTransaction.bdtAmount}
                    onChangeText={(text) => setEditingTransaction({ ...editingTransaction, bdtAmount: text })}
                    keyboardType="numeric"
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Supplier Rate (BDT per $)"
                    value={editingTransaction.rate}
                    onChangeText={(text) => setEditingTransaction({ ...editingTransaction, rate: text })}
                    keyboardType="numeric"
                  />
                </>
              )
            ) : (
              <TextInput
                style={styles.input}
                placeholder="Amount in USD"
                value={editingTransaction.amountUSD}
                onChangeText={(text) => setEditingTransaction({ ...editingTransaction, amountUSD: text })}
                keyboardType="numeric"
              />
            )}

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description (Optional)"
              value={editingTransaction.description}
              onChangeText={(text) => setEditingTransaction({ ...editingTransaction, description: text })}
              multiline
              numberOfLines={3}
            />

            <TextInput
              style={styles.input}
              placeholder="Date (YYYY-MM-DD)"
              value={editingTransaction.date}
              onChangeText={(text) => setEditingTransaction({ ...editingTransaction, date: text })}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleUpdateTransaction}>
                <Text style={styles.modalButtonText}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
