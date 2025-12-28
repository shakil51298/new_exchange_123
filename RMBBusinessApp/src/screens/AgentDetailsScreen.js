import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
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
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import styles from '../styles/styles';

import { formatCurrency } from '../utils/format';
import { getTodayDate } from '../utils/date';

export default function AgentDetailsScreen({ route }) {
  const { agent } = route.params;

  const [agentData, setAgentData] = useState(agent);
  const [transactions, setTransactions] = useState([]);

  const [dhsModalVisible, setDhsModalVisible] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);

  const [usdRate, setUsdRate] = useState('125');
  const [refreshing, setRefreshing] = useState(false);

  const [newDHS, setNewDHS] = useState({
    bdtAmount: '',
    dhsRate: '34.24',
    description: '',
    date: getTodayDate(),
  });

  const [newPayment, setNewPayment] = useState({
    amountDHS: '',
    dhsRate: '34.24',
    description: '',
    date: getTodayDate(),
  });

  const [editingTransaction, setEditingTransaction] = useState({
    id: '',
    type: '',
    bdtAmount: '',
    dhsRate: '',
    dhsAmount: '',
    amountDHS: '',
    description: '',
    calculation: '',
    date: getTodayDate(),
    timestamp: '',
  });

  useEffect(() => {
    loadTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTransactions = async () => {
    try {
      const transactionsRef = collection(db, `agents/${agent.id}/transactions`);
      const querySnapshot = await getDocs(transactionsRef);

      const list = [];
      querySnapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));

      list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setTransactions(list);

      await AsyncStorage.setItem(`agent_transactions_${agent.id}`, JSON.stringify(list));
    } catch (error) {
      console.error('Error loading transactions:', error);

      const stored = await AsyncStorage.getItem(`agent_transactions_${agent.id}`);
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

  const saveTransaction = async (type, data, isEdit = false) => {
    try {
      const newTransaction = {
        agentId: agent.id,
        agentName: agent.name,
        type,
        ...data,
        date: data.date || getTodayDate(),
        timestamp: isEdit
          ? editingTransaction.timestamp || new Date().toISOString()
          : new Date().toISOString(),
      };

      Object.keys(newTransaction).forEach((key) => {
        if (newTransaction[key] === undefined) delete newTransaction[key];
      });

      let balanceChange = 0;
      if (type === 'dhs') {
        balanceChange = data.bdtAmount || 0;
      } else if (type === 'payment') {
        const dhsAmount = data.amountDHS || 0;
        const rate = data.dhsRate || 34.24;
        balanceChange = -(dhsAmount * rate);
      }

      const currentBalance = parseFloat(agentData.balance) || 0;

      if (isEdit && editingTransaction.id) {
        const oldTransaction = transactions.find((t) => t.id === editingTransaction.id);

        let oldReverse = 0;
        if (oldTransaction?.type === 'dhs') {
          oldReverse = -(oldTransaction.bdtAmount || 0);
        } else if (oldTransaction?.type === 'payment') {
          const oldDhs = oldTransaction.amountDHS || 0;
          const oldRate = oldTransaction.dhsRate || 34.24;
          oldReverse = oldDhs * oldRate;
        }

        const balanceAfterReverse = currentBalance + oldReverse;
        const finalBalance = balanceAfterReverse + balanceChange;

        const updateData = { ...newTransaction };
        delete updateData.id;
        delete updateData.createdAt;

        await updateDoc(doc(db, `agents/${agent.id}/transactions`, editingTransaction.id), updateData);

        const updatedTransactions = transactions.map((t) =>
          t.id === editingTransaction.id ? { ...t, ...newTransaction } : t
        );
        updatedTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setTransactions(updatedTransactions);
        await AsyncStorage.setItem(`agent_transactions_${agent.id}`, JSON.stringify(updatedTransactions));

        const updatedAgent = { ...agentData, balance: finalBalance };
        setAgentData(updatedAgent);

        await updateDoc(doc(db, 'agents', agent.id), { balance: finalBalance, updatedAt: getTodayDate() });

        const storedAgents = await AsyncStorage.getItem('agents');
        if (storedAgents) {
          const agentsList = JSON.parse(storedAgents);
          const updatedAgents = agentsList.map((a) => (a.id === agent.id ? updatedAgent : a));
          await AsyncStorage.setItem('agents', JSON.stringify(updatedAgents));
        }
      } else {
        newTransaction.createdAt = getTodayDate();

        const docRef = await addDoc(collection(db, `agents/${agent.id}/transactions`), newTransaction);
        const tx = { id: docRef.id, ...newTransaction };

        const updatedTransactions = [tx, ...transactions].sort(
          (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
        );
        setTransactions(updatedTransactions);
        await AsyncStorage.setItem(`agent_transactions_${agent.id}`, JSON.stringify(updatedTransactions));

        const newBalance = currentBalance + balanceChange;
        const updatedAgent = { ...agentData, balance: newBalance };
        setAgentData(updatedAgent);

        await updateDoc(doc(db, 'agents', agent.id), { balance: newBalance, updatedAt: getTodayDate() });

        const storedAgents = await AsyncStorage.getItem('agents');
        if (storedAgents) {
          const agentsList = JSON.parse(storedAgents);
          const updatedAgents = agentsList.map((a) => (a.id === agent.id ? updatedAgent : a));
          await AsyncStorage.setItem('agents', JSON.stringify(updatedAgents));
        }
      }

      Alert.alert('Success', isEdit ? 'Transaction updated!' : 'Transaction saved!');

      if (type === 'dhs') {
        setDhsModalVisible(false);
        setNewDHS({ bdtAmount: '', dhsRate: '34.24', description: '', date: getTodayDate() });
      } else {
        setPaymentModalVisible(false);
        setNewPayment({ amountDHS: '', dhsRate: '34.24', description: '', date: getTodayDate() });
      }

      if (isEdit) {
        setEditModalVisible(false);
        setEditingTransaction({
          id: '',
          type: '',
          bdtAmount: '',
          dhsRate: '',
          dhsAmount: '',
          amountDHS: '',
          description: '',
          calculation: '',
          date: getTodayDate(),
          timestamp: '',
        });
      }
    } catch (error) {
      console.error('Error saving transaction:', error);
      Alert.alert('Error', `Failed to save: ${error.message}`);
    }
  };

  const handleNewDHS = () => {
    if (!newDHS.bdtAmount || !newDHS.dhsRate) {
      Alert.alert('Error', 'Please enter BDT amount and DHS rate');
      return;
    }

    const bdtAmount = parseFloat(newDHS.bdtAmount) || 0;
    const rate = parseFloat(newDHS.dhsRate) || 34.24;
    const dhsAmount = rate > 0 ? bdtAmount / rate : 0;

    saveTransaction('dhs', {
      ...newDHS,
      bdtAmount,
      dhsRate: rate,
      dhsAmount,
      calculation: `${bdtAmount} BDT ÷ ${rate} = ${dhsAmount.toFixed(2)} DHS`,
    });
  };

  const handlePayment = () => {
    if (!newPayment.amountDHS || !newPayment.dhsRate) {
      Alert.alert('Error', 'Please enter DHS amount and rate');
      return;
    }

    const dhsAmount = parseFloat(newPayment.amountDHS) || 0;
    const rate = parseFloat(newPayment.dhsRate) || 34.24;
    const bdtAmount = dhsAmount * rate;

    saveTransaction('payment', {
      ...newPayment,
      amountDHS: dhsAmount,
      dhsRate: rate,
      bdtAmount,
      calculation: `${dhsAmount} DHS × ${rate} = ${bdtAmount.toFixed(2)} BDT`,
    });
  };

  const handleUpdateTransaction = () => {
    if (editingTransaction.type === 'dhs') {
      if (!editingTransaction.bdtAmount || !editingTransaction.dhsRate) {
        Alert.alert('Error', 'Please enter BDT amount and DHS rate');
        return;
      }

      const bdtAmount = parseFloat(editingTransaction.bdtAmount) || 0;
      const rate = parseFloat(editingTransaction.dhsRate) || 34.24;
      const dhsAmount = rate > 0 ? bdtAmount / rate : 0;

      saveTransaction(
        'dhs',
        {
          bdtAmount,
          dhsRate: rate,
          dhsAmount,
          calculation: `${bdtAmount} BDT ÷ ${rate} = ${dhsAmount.toFixed(2)} DHS`,
          description: editingTransaction.description,
          date: editingTransaction.date,
        },
        true
      );
    } else {
      if (!editingTransaction.amountDHS || !editingTransaction.dhsRate) {
        Alert.alert('Error', 'Please enter DHS amount and rate');
        return;
      }

      const dhsAmount = parseFloat(editingTransaction.amountDHS) || 0;
      const rate = parseFloat(editingTransaction.dhsRate) || 34.24;
      const bdtAmount = dhsAmount * rate;

      saveTransaction(
        'payment',
        {
          amountDHS: dhsAmount,
          dhsRate: rate,
          bdtAmount,
          calculation: `${dhsAmount} DHS × ${rate} = ${bdtAmount.toFixed(2)} BDT`,
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
      bdtAmount: transaction.bdtAmount?.toString() || '',
      dhsRate: transaction.dhsRate?.toString() || '',
      dhsAmount: transaction.dhsAmount?.toString() || '',
      amountDHS: transaction.amountDHS?.toString() || '',
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
            const t = transactions.find((x) => x.id === transactionId);
            if (!t) return;

            let reverse = 0;
            if (t.type === 'dhs') reverse = -(t.bdtAmount || 0);
            if (t.type === 'payment') reverse = t.bdtAmount || 0;

            const currentBalance = parseFloat(agentData.balance) || 0;
            const newBalance = currentBalance + reverse;

            await deleteDoc(doc(db, `agents/${agent.id}/transactions`, transactionId));

            const updatedTransactions = transactions
              .filter((x) => x.id !== transactionId)
              .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            setTransactions(updatedTransactions);
            await AsyncStorage.setItem(`agent_transactions_${agent.id}`, JSON.stringify(updatedTransactions));

            const updatedAgent = { ...agentData, balance: newBalance };
            setAgentData(updatedAgent);

            await updateDoc(doc(db, 'agents', agent.id), { balance: newBalance, updatedAt: getTodayDate() });

            const storedAgents = await AsyncStorage.getItem('agents');
            if (storedAgents) {
              const agentsList = JSON.parse(storedAgents);
              const updatedAgents = agentsList.map((a) => (a.id === agent.id ? updatedAgent : a));
              await AsyncStorage.setItem('agents', JSON.stringify(updatedAgents));
            }

            Alert.alert('Success', 'Transaction deleted!');
          } catch (error) {
            console.error('Error deleting transaction:', error);
            Alert.alert('Error', 'Failed to delete');
          }
        },
      },
    ]);
  };

  const calculateDHSBalance = () => {
    let dhsBalance = 0;
    transactions.forEach((t) => {
      if (t.type === 'dhs') dhsBalance += t.dhsAmount || 0;
      if (t.type === 'payment') dhsBalance -= t.amountDHS || 0;
    });
    return dhsBalance;
  };

  const dhsBalance = calculateDHSBalance();

  const TypeBadge = ({ type }) => {
    const isDhs = type === 'dhs';
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name={isDhs ? 'swap-horizontal' : 'cash-check'} size={16} color={isDhs ? '#0A84FF' : '#34C759'} />
        <Text style={styles.transactionTypeText}>{isDhs ? 'DHS' : 'PAYMENT'}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.agentHeader}>
        <Text style={styles.customerName}>{agentData.name}</Text>

        {agentData.contact ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="phone" size={14} color="#666" />
            <Text style={styles.customerContact}>{agentData.contact}</Text>
          </View>
        ) : null}

        <View
          style={[
            styles.balanceCard,
            agentData.balance > 0
              ? styles.balanceOwe
              : agentData.balance < 0
              ? styles.balanceReceive
              : styles.balanceNeutral,
          ]}
        >
          <Text style={styles.balanceTitle}>
            {agentData.balance > 0 ? 'Agent Owes You' : agentData.balance < 0 ? 'You Owe Agent' : 'Balance Settled'}
          </Text>

          <Text style={styles.balanceAmount}>{formatCurrency(Math.abs(agentData.balance))}</Text>

          <View style={styles.dhsBalanceContainer}>
            <Text style={styles.dhsBalanceLabel}>DHS Balance:</Text>
            <Text style={[styles.dhsBalanceAmount, dhsBalance >= 0 ? styles.positiveBalance : styles.negativeBalance]}>
              {dhsBalance.toFixed(2)} DHS
            </Text>
          </View>

          {usdRate ? (
            <View style={styles.conversionContainer}>
              <Text style={styles.conversionText}>
                Value in USD: ${(Math.abs(agentData.balance) / parseFloat(usdRate || 125)).toFixed(2)}
              </Text>
            </View>
          ) : null}

          <Text style={styles.transactionCount}>
            {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity style={[styles.actionButtonLarge, styles.dhsButton]} onPress={() => setDhsModalVisible(true)}>
          <Icon name="swap-horizontal" size={22} color="white" />
          <Text style={styles.actionButtonText}>New DHS</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButtonLarge, styles.paymentButton]} onPress={() => setPaymentModalVisible(true)}>
          <Icon name="cash-check" size={22} color="white" />
          <Text style={styles.actionButtonText}>Payment</Text>
        </TouchableOpacity>
      </View>

      {/* Transaction Header */}
      <View style={styles.transactionHeader}>
        <Text style={styles.sectionTitle}>Transactions</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Icon name="refresh" size={18} color="#007AFF" />
        </TouchableOpacity>
      </View>

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
                  <Icon name="delete" size={16} color="#FF3B30" />
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

            {item.type === 'dhs' ? (
              <View style={styles.transactionDetails}>
                <View style={styles.transactionRow}>
                  <Text style={styles.transactionLabel}>BDT Amount:</Text>
                  <Text style={styles.transactionValue}>{formatCurrency(item.bdtAmount)}</Text>
                </View>

                <View style={styles.transactionRow}>
                  <Text style={styles.transactionLabel}>DHS Rate:</Text>
                  <Text style={styles.transactionValue}>{item.dhsRate} BDT/DHS</Text>
                </View>

                <View style={styles.transactionRow}>
                  <Text style={styles.transactionLabel}>DHS Amount:</Text>
                  <Text style={[styles.transactionValue, styles.boldText]}>{item.dhsAmount?.toFixed(2)} DHS</Text>
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
            ) : (
              <View style={styles.transactionDetails}>
                <View style={styles.transactionRow}>
                  <Text style={styles.transactionLabel}>Payment Amount:</Text>
                  <Text style={[styles.transactionValue, styles.boldText]}>{item.amountDHS?.toFixed(2)} DHS</Text>
                </View>

                <View style={styles.transactionRow}>
                  <Text style={styles.transactionLabel}>DHS Rate:</Text>
                  <Text style={styles.transactionValue}>{item.dhsRate} BDT/DHS</Text>
                </View>

                <View style={styles.transactionRow}>
                  <Text style={styles.transactionLabel}>BDT Value:</Text>
                  <Text style={styles.transactionValue}>{formatCurrency(item.bdtAmount)}</Text>
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
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyTransactionState}>
            <Icon name="receipt-text-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTransactionText}>No transactions yet</Text>
            <Text style={styles.emptyTransactionSubtext}>Add your first DHS record or payment</Text>
          </View>
        }
      />

      {/* DHS Modal */}
      <Modal transparent visible={dhsModalVisible} onRequestClose={() => setDhsModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="swap-horizontal" size={20} color="#0A84FF" />
              <Text style={styles.modalTitle}>New DHS Record</Text>
            </View>

            <TextInput style={styles.input} placeholder="BDT Amount" value={newDHS.bdtAmount} onChangeText={(t) => setNewDHS({ ...newDHS, bdtAmount: t })} keyboardType="numeric" />
            <TextInput style={styles.input} placeholder="DHS Rate (BDT per DHS)" value={newDHS.dhsRate} onChangeText={(t) => setNewDHS({ ...newDHS, dhsRate: t })} keyboardType="numeric" />
            <TextInput style={[styles.input, styles.textArea]} placeholder="Description (Optional)" value={newDHS.description} onChangeText={(t) => setNewDHS({ ...newDHS, description: t })} multiline numberOfLines={2} />

            {newDHS.bdtAmount && newDHS.dhsRate ? (
              <View style={styles.calculationBox}>
                <Text style={styles.calculationText}>
                  DHS Amount:{' '}
                  {((parseFloat(newDHS.bdtAmount) || 0) / (parseFloat(newDHS.dhsRate) || 34.24)).toFixed(2)} DHS
                </Text>
                <Text style={styles.calculationFormula}>
                  {newDHS.bdtAmount} BDT ÷ {newDHS.dhsRate} ={' '}
                  {((parseFloat(newDHS.bdtAmount) || 0) / (parseFloat(newDHS.dhsRate) || 34.24)).toFixed(2)} DHS
                </Text>
              </View>
            ) : null}

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setDhsModalVisible(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleNewDHS}>
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Payment Modal */}
      <Modal transparent visible={paymentModalVisible} onRequestClose={() => setPaymentModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="cash-check" size={20} color="#34C759" />
              <Text style={styles.modalTitle}>Make Payment (DHS)</Text>
            </View>

            <TextInput style={styles.input} placeholder="Amount in DHS" value={newPayment.amountDHS} onChangeText={(t) => setNewPayment({ ...newPayment, amountDHS: t })} keyboardType="numeric" />
            <TextInput style={styles.input} placeholder="DHS Rate (BDT per DHS)" value={newPayment.dhsRate} onChangeText={(t) => setNewPayment({ ...newPayment, dhsRate: t })} keyboardType="numeric" />
            <TextInput style={[styles.input, styles.textArea]} placeholder="Description (Optional)" value={newPayment.description} onChangeText={(t) => setNewPayment({ ...newPayment, description: t })} multiline numberOfLines={2} />

            {newPayment.amountDHS && newPayment.dhsRate ? (
              <View style={styles.calculationBox}>
                <Text style={styles.calculationText}>
                  BDT Value: {formatCurrency((parseFloat(newPayment.amountDHS) || 0) * (parseFloat(newPayment.dhsRate) || 34.24))}
                </Text>
                <Text style={styles.calculationFormula}>
                  {newPayment.amountDHS} DHS × {newPayment.dhsRate} ={' '}
                  {((parseFloat(newPayment.amountDHS) || 0) * (parseFloat(newPayment.dhsRate) || 34.24)).toFixed(2)} BDT
                </Text>
              </View>
            ) : null}

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setPaymentModalVisible(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handlePayment}>
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Modal */}
      <Modal transparent visible={editModalVisible} onRequestClose={() => setEditModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="pencil" size={20} color="#007AFF" />
              <Text style={styles.modalTitle}>
                Edit {editingTransaction.type === 'dhs' ? 'DHS Record' : 'Payment'}
              </Text>
            </View>

            {editingTransaction.type === 'dhs' ? (
              <>
                <TextInput style={styles.input} placeholder="BDT Amount" value={editingTransaction.bdtAmount} onChangeText={(t) => setEditingTransaction({ ...editingTransaction, bdtAmount: t })} keyboardType="numeric" />
                <TextInput style={styles.input} placeholder="DHS Rate (BDT per DHS)" value={editingTransaction.dhsRate} onChangeText={(t) => setEditingTransaction({ ...editingTransaction, dhsRate: t })} keyboardType="numeric" />
              </>
            ) : (
              <>
                <TextInput style={styles.input} placeholder="Amount in DHS" value={editingTransaction.amountDHS} onChangeText={(t) => setEditingTransaction({ ...editingTransaction, amountDHS: t })} keyboardType="numeric" />
                <TextInput style={styles.input} placeholder="DHS Rate (BDT per DHS)" value={editingTransaction.dhsRate} onChangeText={(t) => setEditingTransaction({ ...editingTransaction, dhsRate: t })} keyboardType="numeric" />
              </>
            )}

            <TextInput style={[styles.input, styles.textArea]} placeholder="Description (Optional)" value={editingTransaction.description} onChangeText={(t) => setEditingTransaction({ ...editingTransaction, description: t })} multiline numberOfLines={3} />
            <TextInput style={styles.input} placeholder="Date (YYYY-MM-DD)" value={editingTransaction.date} onChangeText={(t) => setEditingTransaction({ ...editingTransaction, date: t })} />

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
