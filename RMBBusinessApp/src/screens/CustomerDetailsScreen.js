import React, { useEffect, useMemo, useState } from 'react';
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
  ActivityIndicator,
} from 'react-native';

import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  increment,
} from 'firebase/firestore';

import { db } from '../config/firebase';
import styles from '../styles/styles';
import { formatCurrency, formatUSD } from '../utils/format';
import { getTodayDate } from '../utils/date';

/**
 * ✅ Big list safe bank selector:
 * Separate modal with its own FlatList (no nested VirtualizedList issues).
 */
function BankPickerModal({
  visible,
  onClose,
  banks,
  bankSearch,
  setBankSearch,
  onSelect,
}) {
  const filtered = useMemo(() => {
    const q = (bankSearch || '').toLowerCase().trim();
    if (!q) return banks || [];
    return (banks || []).filter(b => (b.name || '').toLowerCase().includes(q));
  }, [banks, bankSearch]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'flex-end' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ backgroundColor: 'rgba(0,0,0,0.4)', flex: 1 }} />

        <View
          style={{
            backgroundColor: '#fff',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            height: '80%',
          }}
        >
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="bank" size={18} color="#111" />
                <Text style={{ fontSize: 16, fontWeight: '800' }}>Select Bank</Text>
              </View>

              <TouchableOpacity onPress={onClose} style={{ padding: 6 }}>
                <Icon name="close" size={22} color="#111" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.input, { marginTop: 10 }]}
              placeholder="Search bank..."
              value={bankSearch}
              onChangeText={setBankSearch}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(i) => i.id}
            keyboardShouldPersistTaps="always"
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            windowSize={15}
            removeClippedSubviews
            renderItem={({ item }) => (
              <TouchableOpacity
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(0,0,0,0.06)',
                }}
                onPress={() => onSelect(item)}
              >
                <Text style={{ fontWeight: '800', color: '#111' }}>
                  {item.name || 'Unnamed Bank'}
                </Text>

                {typeof item.balance !== 'undefined' && (
                  <Text style={{ marginTop: 4, fontSize: 12, color: '#777' }}>
                    Balance: {formatCurrency(parseFloat(item.balance || 0))}
                  </Text>
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={{ padding: 20 }}>
                <Text style={{ color: '#777' }}>No banks found</Text>
              </View>
            }
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function CustomerDetailsScreen({ route }) {
  const { customer } = route.params;

  const [customerData, setCustomerData] = useState(customer);
  const [transactions, setTransactions] = useState([]);

  const [suppliers, setSuppliers] = useState([]);
  const [banks, setBanks] = useState([]);

  const [refreshing, setRefreshing] = useState(false);

  // ✅ Working spinner state
  const [isWorking, setIsWorking] = useState(false);
  const [workingLabel, setWorkingLabel] = useState('Processing...');

  const showWorking = (label = 'Processing...') => {
    setWorkingLabel(label);
    setIsWorking(true);
  };

  const hideWorking = () => setIsWorking(false);

  // ----- Order Modal -----
  const [orderModalVisible, setOrderModalVisible] = useState(false);
  const [supplierDropdownOpen, setSupplierDropdownOpen] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');

  const [newOrder, setNewOrder] = useState({
    rmbAmount: '',
    customerRmbRate: '', // BDT per RMB
    supplierId: '',
    supplierName: '',
    supplierRate: '', // RMB per $
    date: getTodayDate(),
    notes: '',
  });

  // ----- Payment Modal -----
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);

  const [bankPickerVisible, setBankPickerVisible] = useState(false);
  const [bankSearch, setBankSearch] = useState('');

  const [newPayment, setNewPayment] = useState({
    amount: '',
    bankId: '',
    bankName: '',
    date: getTodayDate(),
    notes: '',
  });

  // ----- Edit Modal -----
  const [editModalVisible, setEditModalVisible] = useState(false);

  const [editingTx, setEditingTx] = useState({
    id: '',
    type: '',
    date: getTodayDate(),
    notes: '',

    // order fields
    supplierId: '',
    supplierName: '',
    supplierTransactionId: '',
    rmbAmount: '',
    customerRmbRate: '',
    supplierRate: '',
    billBDT: 0,
    supplierAmountUSD: 0,

    // payment fields
    bankId: '',
    bankName: '',
    bankTransactionId: '',
    amount: '',
  });

  // ---------- Loaders ----------
  useEffect(() => {
    loadTransactions();
    loadSuppliers();
    loadBanks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTransactions = async () => {
    try {
      const snap = await getDocs(collection(db, `customers/${customer.id}/transactions`));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setTransactions(list);
      await AsyncStorage.setItem(`transactions_${customer.id}`, JSON.stringify(list));
    } catch (e) {
      console.error('Error loading customer transactions:', e);
      const cached = await AsyncStorage.getItem(`transactions_${customer.id}`);
      if (cached) {
        const list = JSON.parse(cached);
        list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setTransactions(list);
      }
    }
  };

  const loadSuppliers = async () => {
    try {
      const snap = await getDocs(collection(db, 'suppliers'));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSuppliers(list.filter(s => s.type === 'RMB' || !s.type));
    } catch (e) {
      console.error('Error loading suppliers:', e);
    }
  };

  const loadBanks = async () => {
    try {
      const snap = await getDocs(collection(db, 'banks'));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setBanks(list);
    } catch (e) {
      console.error('Error loading banks:', e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTransactions();
    setRefreshing(false);
  };

  // ---------- Calculations (Order) ----------
  const rmbAmountNum = useMemo(() => parseFloat(newOrder.rmbAmount) || 0, [newOrder.rmbAmount]);
  const customerRateNum = useMemo(() => parseFloat(newOrder.customerRmbRate) || 0, [newOrder.customerRmbRate]);
  const supplierRateNum = useMemo(() => parseFloat(newOrder.supplierRate) || 0, [newOrder.supplierRate]);

  const customerBillBDT = useMemo(() => rmbAmountNum * customerRateNum, [rmbAmountNum, customerRateNum]);
  const supplierBillUSD = useMemo(() => (supplierRateNum > 0 ? rmbAmountNum / supplierRateNum : 0), [rmbAmountNum, supplierRateNum]);

  const canSubmitOrder = useMemo(
    () => rmbAmountNum > 0 && customerRateNum > 0 && !!newOrder.supplierId && supplierRateNum > 0,
    [rmbAmountNum, customerRateNum, supplierRateNum, newOrder.supplierId]
  );

  const filteredSuppliers = useMemo(() => {
    const q = supplierSearch.toLowerCase().trim();
    if (!q) return suppliers || [];
    return (suppliers || []).filter(s => (s.name || '').toLowerCase().includes(q));
  }, [suppliers, supplierSearch]);

  // ---------- Calculations (Payment) ----------
  const paymentAmountNum = useMemo(() => parseFloat(newPayment.amount) || 0, [newPayment.amount]);
  const canSubmitPayment = useMemo(() => paymentAmountNum > 0 && !!newPayment.bankId, [paymentAmountNum, newPayment.bankId]);

  // ---------- Reset Helpers ----------
  const resetNewOrderForm = () => {
    setNewOrder({
      rmbAmount: '',
      customerRmbRate: '',
      supplierId: '',
      supplierName: '',
      supplierRate: '',
      date: getTodayDate(),
      notes: '',
    });
    setSupplierDropdownOpen(false);
    setSupplierSearch('');
  };

  const resetNewPaymentForm = () => {
    setNewPayment({
      amount: '',
      bankId: '',
      bankName: '',
      date: getTodayDate(),
      notes: '',
    });
    setBankSearch('');
  };

  // ---------- Stylish Buttons ----------
  const fancyBtn = {
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  };

  const cancelBtn = {
    ...fancyBtn,
    backgroundColor: '#F2F4F7',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.10)',
  };

  const primaryBtn = (disabled = false) => ({
    ...fancyBtn,
    backgroundColor: disabled ? '#9CC8FF' : '#0A84FF',
    shadowColor: '#0A84FF',
    shadowOpacity: disabled ? 0 : 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: disabled ? 0 : 6,
  });

  const btnTextDark = { fontWeight: '800', color: '#111', fontSize: 14 };
  const btnTextLight = { fontWeight: '800', color: 'white', fontSize: 14 };

  // ---------- ORDER create ----------
  const createOrderDual = async () => {
    if (isWorking) return;
    if (!canSubmitOrder) {
      Alert.alert('Missing info', 'Enter RMB amount, customer rate, select supplier, and supplier rate.');
      return;
    }

    showWorking('Saving order...');
    try {
      const timestamp = new Date().toISOString();

      const supplierTxPayload = {
        type: 'bill',
        supplierId: newOrder.supplierId,
        supplierName: newOrder.supplierName,
        rmbAmount: rmbAmountNum,
        rate: supplierRateNum,
        amountUSD: supplierBillUSD,
        customerId: customer.id,
        customerName: customer.name,
        notes: newOrder.notes || '',
        date: newOrder.date || getTodayDate(),
        timestamp,
        createdAt: getTodayDate(),
        calculation: `${rmbAmountNum} RMB ÷ ${supplierRateNum} = ${supplierBillUSD.toFixed(2)} USD`,
      };

      const supplierTxRef = await addDoc(
        collection(db, `suppliers/${newOrder.supplierId}/transactions`),
        supplierTxPayload
      );

      const customerTxPayload = {
        type: 'order',
        customerId: customer.id,
        customerName: customer.name,

        rmbAmount: rmbAmountNum,
        customerRmbRate: customerRateNum,
        billBDT: customerBillBDT,

        supplierId: newOrder.supplierId,
        supplierName: newOrder.supplierName,
        supplierRate: supplierRateNum,

        supplierTransactionId: supplierTxRef.id,
        supplierAmountUSD: supplierBillUSD,

        notes: newOrder.notes || '',
        date: newOrder.date || getTodayDate(),
        timestamp,
        createdAt: getTodayDate(),
      };

      const customerTxRef = await addDoc(
        collection(db, `customers/${customer.id}/transactions`),
        customerTxPayload
      );

      await updateDoc(doc(db, 'customers', customer.id), {
        balance: increment(customerBillBDT),
        updatedAt: getTodayDate(),
      });

      await updateDoc(doc(db, 'suppliers', newOrder.supplierId), {
        balanceUSD: increment(supplierBillUSD),
        updatedAt: getTodayDate(),
      });

      setCustomerData(prev => ({
        ...prev,
        balance: (parseFloat(prev.balance) || 0) + customerBillBDT,
      }));

      const txWithId = { id: customerTxRef.id, ...customerTxPayload };
      const next = [txWithId, ...transactions].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setTransactions(next);
      await AsyncStorage.setItem(`transactions_${customer.id}`, JSON.stringify(next));

      Alert.alert('Success', 'Order created for customer + supplier.');
      setOrderModalVisible(false);
      resetNewOrderForm();
    } catch (e) {
      console.error('Create order failed:', e);
      Alert.alert('Error', e?.message || 'Failed to create order');
    } finally {
      hideWorking();
    }
  };

  // ---------- PAYMENT create ----------
  const receivePaymentDual = async () => {
    if (isWorking) return;
    if (!canSubmitPayment) {
      Alert.alert('Missing info', 'Enter amount and select a bank.');
      return;
    }

    showWorking('Saving payment...');
    try {
      const timestamp = new Date().toISOString();
      const amount = paymentAmountNum;

      const bankTxPayload = {
        type: 'credit',
        amount,
        customerId: customer.id,
        customerName: customer.name,
        notes: newPayment.notes || '',
        date: newPayment.date || getTodayDate(),
        timestamp,
        createdAt: getTodayDate(),
      };

      const bankTxRef = await addDoc(
        collection(db, `banks/${newPayment.bankId}/transactions`),
        bankTxPayload
      );

      const customerTxPayload = {
        type: 'payment',
        amount,
        bankId: newPayment.bankId,
        bankName: newPayment.bankName,
        bankTransactionId: bankTxRef.id,
        notes: newPayment.notes || '',
        date: newPayment.date || getTodayDate(),
        timestamp,
        createdAt: getTodayDate(),
      };

      const customerTxRef = await addDoc(
        collection(db, `customers/${customer.id}/transactions`),
        customerTxPayload
      );

      await updateDoc(doc(db, 'customers', customer.id), {
        balance: increment(-amount),
        updatedAt: getTodayDate(),
      });

      await updateDoc(doc(db, 'banks', newPayment.bankId), {
        balance: increment(amount),
        updatedAt: getTodayDate(),
      });

      setCustomerData(prev => ({
        ...prev,
        balance: (parseFloat(prev.balance) || 0) - amount,
      }));

      const txWithId = { id: customerTxRef.id, ...customerTxPayload };
      const next = [txWithId, ...transactions].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setTransactions(next);
      await AsyncStorage.setItem(`transactions_${customer.id}`, JSON.stringify(next));

      Alert.alert('Success', 'Payment recorded (Customer + Bank updated).');
      setPaymentModalVisible(false);
      resetNewPaymentForm();
    } catch (e) {
      console.error('Receive payment failed:', e);
      Alert.alert('Error', e?.message || 'Failed to save payment');
    } finally {
      hideWorking();
    }
  };

  // ---------- EDIT ----------
  const openEdit = (tx) => {
    setEditingTx({
      id: tx.id,
      type: tx.type,
      date: tx.date || getTodayDate(),
      notes: tx.notes || '',

      supplierId: tx.supplierId || '',
      supplierName: tx.supplierName || '',
      supplierTransactionId: tx.supplierTransactionId || '',
      rmbAmount: (tx.rmbAmount ?? '').toString(),
      customerRmbRate: (tx.customerRmbRate ?? '').toString(),
      supplierRate: (tx.supplierRate ?? '').toString(),
      billBDT: parseFloat(tx.billBDT || 0),
      supplierAmountUSD: parseFloat(tx.supplierAmountUSD || 0),

      bankId: tx.bankId || '',
      bankName: tx.bankName || '',
      bankTransactionId: tx.bankTransactionId || '',
      amount: (tx.amount ?? '').toString(),
    });
    setEditModalVisible(true);
  };

  const saveEdit = async () => {
    if (isWorking) return;
    showWorking('Updating transaction...');

    try {
      if (!editingTx.id || !editingTx.type) return;

      if (editingTx.type === 'order') {
        const newRmb = parseFloat(editingTx.rmbAmount) || 0;
        const newCustomerRate = parseFloat(editingTx.customerRmbRate) || 0;
        const newSupplierRate = parseFloat(editingTx.supplierRate) || 0;

        if (newRmb <= 0 || newCustomerRate <= 0 || newSupplierRate <= 0) {
          Alert.alert('Error', 'Please enter valid RMB amount, customer rate, and supplier rate.');
          return;
        }
        if (!editingTx.supplierId || !editingTx.supplierTransactionId) {
          Alert.alert('Error', 'Linked supplier transaction missing. (Cannot edit this order safely)');
          return;
        }

        const oldBillBDT = parseFloat(editingTx.billBDT || 0);
        const oldSupplierUSD = parseFloat(editingTx.supplierAmountUSD || 0);

        const newBillBDT = newRmb * newCustomerRate;
        const newSupplierUSD = newSupplierRate > 0 ? newRmb / newSupplierRate : 0;

        const deltaCustomerBDT = newBillBDT - oldBillBDT;
        const deltaSupplierUSD = newSupplierUSD - oldSupplierUSD;

        await updateDoc(doc(db, `customers/${customer.id}/transactions`, editingTx.id), {
          rmbAmount: newRmb,
          customerRmbRate: newCustomerRate,
          billBDT: newBillBDT,
          supplierRate: newSupplierRate,
          supplierAmountUSD: newSupplierUSD,
          notes: editingTx.notes || '',
          date: editingTx.date || getTodayDate(),
        });

        await updateDoc(
          doc(db, `suppliers/${editingTx.supplierId}/transactions`, editingTx.supplierTransactionId),
          {
            rmbAmount: newRmb,
            rate: newSupplierRate,
            amountUSD: newSupplierUSD,
            notes: editingTx.notes || '',
            date: editingTx.date || getTodayDate(),
            calculation: `${newRmb} RMB ÷ ${newSupplierRate} = ${newSupplierUSD.toFixed(2)} USD`,
          }
        );

        await updateDoc(doc(db, 'customers', customer.id), {
          balance: increment(deltaCustomerBDT),
          updatedAt: getTodayDate(),
        });

        await updateDoc(doc(db, 'suppliers', editingTx.supplierId), {
          balanceUSD: increment(deltaSupplierUSD),
          updatedAt: getTodayDate(),
        });

        setCustomerData(prev => ({
          ...prev,
          balance: (parseFloat(prev.balance) || 0) + deltaCustomerBDT,
        }));

        const next = transactions.map(t => {
          if (t.id !== editingTx.id) return t;
          return {
            ...t,
            rmbAmount: newRmb,
            customerRmbRate: newCustomerRate,
            billBDT: newBillBDT,
            supplierRate: newSupplierRate,
            supplierAmountUSD: newSupplierUSD,
            notes: editingTx.notes || '',
            date: editingTx.date || getTodayDate(),
          };
        });

        next.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setTransactions(next);
        await AsyncStorage.setItem(`transactions_${customer.id}`, JSON.stringify(next));

        Alert.alert('Success', 'Order updated (Customer + Supplier).');
        setEditModalVisible(false);
        return;
      }

      if (editingTx.type === 'payment') {
        const newAmt = parseFloat(editingTx.amount) || 0;
        if (newAmt <= 0) {
          Alert.alert('Error', 'Enter a valid payment amount.');
          return;
        }
        if (!editingTx.bankId || !editingTx.bankTransactionId) {
          Alert.alert('Error', 'Linked bank transaction missing. (Cannot edit this payment safely)');
          return;
        }

        const original = transactions.find(t => t.id === editingTx.id);
        const oldAmt = parseFloat(original?.amount || 0);

        const delta = newAmt - oldAmt;
        const deltaCustomerBDT = -delta;
        const deltaBankBDT = delta;

        await updateDoc(doc(db, `customers/${customer.id}/transactions`, editingTx.id), {
          amount: newAmt,
          notes: editingTx.notes || '',
          date: editingTx.date || getTodayDate(),
        });

        await updateDoc(
          doc(db, `banks/${editingTx.bankId}/transactions`, editingTx.bankTransactionId),
          {
            amount: newAmt,
            notes: editingTx.notes || '',
            date: editingTx.date || getTodayDate(),
          }
        );

        await updateDoc(doc(db, 'customers', customer.id), {
          balance: increment(deltaCustomerBDT),
          updatedAt: getTodayDate(),
        });

        await updateDoc(doc(db, 'banks', editingTx.bankId), {
          balance: increment(deltaBankBDT),
          updatedAt: getTodayDate(),
        });

        setCustomerData(prev => ({
          ...prev,
          balance: (parseFloat(prev.balance) || 0) + deltaCustomerBDT,
        }));

        const next = transactions.map(t => {
          if (t.id !== editingTx.id) return t;
          return {
            ...t,
            amount: newAmt,
            notes: editingTx.notes || '',
            date: editingTx.date || getTodayDate(),
          };
        });

        next.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setTransactions(next);
        await AsyncStorage.setItem(`transactions_${customer.id}`, JSON.stringify(next));

        Alert.alert('Success', 'Payment updated (Customer + Bank).');
        setEditModalVisible(false);
        return;
      }

      Alert.alert('Error', 'Only ORDER and PAYMENT can be edited.');
    } catch (e) {
      console.error('Edit save failed:', e);
      Alert.alert('Error', e?.message || 'Failed to update transaction');
    } finally {
      hideWorking();
    }
  };

  // ---------- DELETE ----------
  const deleteTransactionUI = (tx) => {
    if (isWorking) return;

    Alert.alert('Delete Transaction', 'Are you sure you want to delete this transaction?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          showWorking('Deleting...');
          try {
            await deleteDoc(doc(db, `customers/${customer.id}/transactions`, tx.id));

            if (tx.type === 'order' && tx.supplierId && tx.supplierTransactionId) {
              await deleteDoc(doc(db, `suppliers/${tx.supplierId}/transactions`, tx.supplierTransactionId));

              const usd = parseFloat(tx.supplierAmountUSD) || 0;
              await updateDoc(doc(db, 'suppliers', tx.supplierId), {
                balanceUSD: increment(-usd),
                updatedAt: getTodayDate(),
              });

              const bdt = parseFloat(tx.billBDT) || 0;
              await updateDoc(doc(db, 'customers', customer.id), {
                balance: increment(-bdt),
                updatedAt: getTodayDate(),
              });

              setCustomerData(prev => ({
                ...prev,
                balance: (parseFloat(prev.balance) || 0) - bdt,
              }));
            }

            if (tx.type === 'payment' && tx.bankId && tx.bankTransactionId) {
              await deleteDoc(doc(db, `banks/${tx.bankId}/transactions`, tx.bankTransactionId));

              const amt = parseFloat(tx.amount) || 0;
              await updateDoc(doc(db, 'banks', tx.bankId), {
                balance: increment(-amt),
                updatedAt: getTodayDate(),
              });

              await updateDoc(doc(db, 'customers', customer.id), {
                balance: increment(amt),
                updatedAt: getTodayDate(),
              });

              setCustomerData(prev => ({
                ...prev,
                balance: (parseFloat(prev.balance) || 0) + amt,
              }));
            }

            const next = transactions
              .filter(t => t.id !== tx.id)
              .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            setTransactions(next);
            await AsyncStorage.setItem(`transactions_${customer.id}`, JSON.stringify(next));

            Alert.alert('Success', 'Transaction deleted.');
          } catch (e) {
            console.error('Delete failed:', e);
            Alert.alert('Error', e?.message || 'Delete failed');
          } finally {
            hideWorking();
          }
        },
      },
    ]);
  };

  const TxTypeBadge = ({ type }) => {
    const isOrder = type === 'order';
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon
          name={isOrder ? 'package-variant-closed' : 'cash-check'}
          size={16}
          color={isOrder ? '#FF9500' : '#34C759'}
        />
        <Text style={styles.transactionTypeText}>{isOrder ? 'ORDER' : 'PAYMENT'}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* ✅ Global Spinner Overlay */}
      <Modal visible={isWorking} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ backgroundColor: 'white', padding: 18, borderRadius: 14, width: '75%', alignItems: 'center' }}>
            <ActivityIndicator size="large" />
            <Text style={{ marginTop: 12, fontWeight: '800', color: '#111' }}>{workingLabel}</Text>
            <Text style={{ marginTop: 6, fontSize: 12, color: '#777', textAlign: 'center' }}>
              Please wait…
            </Text>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={styles.customerHeader}>
        <Text style={styles.customerName}>{customerData.name}</Text>

        {customerData.phone ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Icon name="phone" size={14} color="#666" />
            <Text style={styles.customerContact}>{customerData.phone}</Text>
          </View>
        ) : null}

        <View
          style={[
            styles.balanceCard,
            customerData.balance > 0
              ? styles.balanceOwe
              : customerData.balance < 0
              ? styles.balanceReceive
              : styles.balanceNeutral,
          ]}
        >
          <Text style={styles.balanceTitle}>
            {customerData.balance > 0
              ? 'You Owe Customer'
              : customerData.balance < 0
              ? 'Customer Owes You'
              : 'Balance Settled'}
          </Text>
          <Text style={styles.balanceAmount}>{formatCurrency(Math.abs(customerData.balance || 0))}</Text>
          <Text style={styles.transactionCount}>
            {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          disabled={isWorking}
          style={[styles.actionButtonLarge, styles.orderButton, isWorking ? { opacity: 0.6 } : null]}
          onPress={() => setOrderModalVisible(true)}
        >
          <Icon name="cart-plus" size={22} color="white" />
          <Text style={styles.actionButtonText}>New Order</Text>
        </TouchableOpacity>

        <TouchableOpacity
          disabled={isWorking}
          style={[styles.actionButtonLarge, styles.paymentButton, isWorking ? { opacity: 0.6 } : null]}
          onPress={() => setPaymentModalVisible(true)}
        >
          <Icon name="cash-plus" size={22} color="white" />
          <Text style={styles.actionButtonText}>Receive Payment</Text>
        </TouchableOpacity>
      </View>

      {/* History header */}
      <View style={styles.transactionHeader}>
        <Text style={styles.sectionTitle}>Transaction History</Text>
        <TouchableOpacity disabled={isWorking} onPress={onRefresh} style={styles.refreshButton}>
          <Icon name="refresh" size={18} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* History list */}
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        refreshing={refreshing}
        onRefresh={onRefresh}
        renderItem={({ item, index }) => (
          <View style={styles.transactionCard}>
            <View style={styles.transactionHeaderRow}>
              <View style={styles.transactionTypeBadge}>
                <TxTypeBadge type={item.type} />
                <Text style={styles.transactionIndex}>#{index + 1}</Text>
              </View>

              <View style={styles.transactionActions}>
                {(item.type === 'order' || item.type === 'payment') && (
                  <TouchableOpacity
                    disabled={isWorking}
                    style={[styles.smallEditButton, isWorking ? { opacity: 0.5 } : null]}
                    onPress={() => openEdit(item)}
                  >
                    <Icon name="pencil" size={16} color="#007AFF" />
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  disabled={isWorking}
                  style={[styles.smallDeleteButton, isWorking ? { opacity: 0.5 } : null]}
                  onPress={() => deleteTransactionUI(item)}
                >
                  <Icon name="trash-can-outline" size={16} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <Icon name="calendar" size={14} color="#666" />
              <Text style={styles.transactionDate}>
                {item.date || ''} •{' '}
                {item.timestamp
                  ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : ''}
              </Text>
            </View>

            {item.type === 'order' ? (
              <View style={styles.transactionDetails}>
                <View style={styles.transactionRow}>
                  <Text style={styles.transactionLabel}>RMB Amount:</Text>
                  <Text style={styles.transactionValue}>{item.rmbAmount}</Text>
                </View>

                {!!item.supplierName && (
                  <View style={styles.transactionRow}>
                    <Text style={styles.transactionLabel}>Supplier:</Text>
                    <Text style={styles.transactionValue}>{item.supplierName}</Text>
                  </View>
                )}

                <View style={styles.transactionRow}>
                  <Text style={styles.transactionLabel}>Customer Rate:</Text>
                  <Text style={styles.transactionValue}>{item.customerRmbRate} BDT/RMB</Text>
                </View>

                <View style={styles.transactionRow}>
                  <Text style={styles.transactionLabel}>Bill Amount:</Text>
                  <Text style={[styles.transactionValue, styles.boldText]}>
                    {formatCurrency(item.billBDT)}
                  </Text>
                </View>

                {item.notes ? (
                  <View style={styles.notesContainer}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Icon name="note-text-outline" size={14} color="#666" />
                      <Text style={styles.notesLabel}>Note:</Text>
                    </View>
                    <Text style={styles.notesText}>{item.notes}</Text>
                  </View>
                ) : null}
              </View>
            ) : item.type === 'payment' ? (
              <View style={styles.transactionDetails}>
                <View style={styles.transactionRow}>
                  <Text style={styles.transactionLabel}>Payment:</Text>
                  <Text style={[styles.transactionValue, styles.boldText]}>
                    {formatCurrency(item.amount)}
                  </Text>
                </View>

                {!!item.bankName && (
                  <View style={styles.transactionRow}>
                    <Text style={styles.transactionLabel}>Bank:</Text>
                    <Text style={styles.transactionValue}>{item.bankName}</Text>
                  </View>
                )}

                {item.notes ? (
                  <View style={styles.notesContainer}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Icon name="note-text-outline" size={14} color="#666" />
                      <Text style={styles.notesLabel}>Note:</Text>
                    </View>
                    <Text style={styles.notesText}>{item.notes}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <Text style={styles.transactionTime}>{item.createdAt ? `Added: ${item.createdAt}` : ''}</Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyTransactionState}>
            <Icon name="receipt" size={64} color="#ccc" />
            <Text style={styles.emptyTransactionText}>No transactions yet</Text>
            <Text style={styles.emptyTransactionSubtext}>Add your first order or payment</Text>
          </View>
        }
      />

      {/* New Order Modal */}
      <Modal
        visible={orderModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setOrderModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: 'flex-end' }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={{ backgroundColor: 'rgba(0,0,0,0.4)', flex: 1 }} />

          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '85%' }}>
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' }}>
              <Text style={{ fontSize: 16, fontWeight: '800' }}>New Order</Text>
              <Text style={{ fontSize: 12, color: '#777', marginTop: 4 }}>
                Create customer + supplier order together
              </Text>
            </View>

            <FlatList
              data={[]}
              renderItem={null}
              keyExtractor={() => 'new-order-form'}
              keyboardShouldPersistTaps="always"
              contentContainerStyle={{ padding: 16 }}
              ListHeaderComponent={
                <>
                  <Text style={{ fontSize: 12, color: '#777', marginBottom: 6 }}>RMB Amount</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 1000"
                    keyboardType="numeric"
                    value={newOrder.rmbAmount}
                    onChangeText={(t) => setNewOrder({ ...newOrder, rmbAmount: t })}
                  />

                  <Text style={{ fontSize: 12, color: '#777', marginBottom: 6 }}>Customer RMB Rate (BDT per RMB)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 16.50"
                    keyboardType="numeric"
                    value={newOrder.customerRmbRate}
                    onChangeText={(t) => setNewOrder({ ...newOrder, customerRmbRate: t })}
                  />

                  <Text style={{ fontSize: 12, color: '#777', marginBottom: 6 }}>Select Supplier</Text>
                  <TouchableOpacity
                    style={[
                      styles.input,
                      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
                    ]}
                    onPress={() => setSupplierDropdownOpen(!supplierDropdownOpen)}
                    activeOpacity={0.85}
                  >
                    <Text style={{ color: newOrder.supplierName ? '#111' : '#999', fontWeight: '600' }}>
                      {newOrder.supplierName ? newOrder.supplierName : 'Tap to choose supplier'}
                    </Text>
                    <Icon
                      name={supplierDropdownOpen ? 'chevron-up' : 'chevron-down'}
                      size={22}
                      color="#555"
                    />
                  </TouchableOpacity>

                  {supplierDropdownOpen && (
                    <View
                      style={{
                        borderWidth: 1,
                        borderColor: 'rgba(0,0,0,0.12)',
                        borderRadius: 10,
                        padding: 10,
                        marginTop: -4,
                        marginBottom: 10,
                      }}
                    >
                      <TextInput
                        style={[styles.input, { marginBottom: 8 }]}
                        placeholder="Search supplier..."
                        value={supplierSearch}
                        onChangeText={setSupplierSearch}
                      />

                      <View style={{ height: 160 }}>
                        <FlatList
                          data={filteredSuppliers}
                          keyExtractor={(i) => i.id}
                          keyboardShouldPersistTaps="always"
                          initialNumToRender={20}
                          maxToRenderPerBatch={20}
                          windowSize={10}
                          removeClippedSubviews
                          renderItem={({ item }) => (
                            <TouchableOpacity
                              style={{
                                paddingVertical: 10,
                                borderBottomWidth: 1,
                                borderBottomColor: 'rgba(0,0,0,0.06)',
                              }}
                              onPress={() => {
                                setNewOrder({
                                  ...newOrder,
                                  supplierId: item.id,
                                  supplierName: item.name || 'Unnamed Supplier',
                                });
                                setSupplierDropdownOpen(false);
                                setSupplierSearch('');
                              }}
                            >
                              <Text style={{ fontWeight: '800', color: '#111' }}>
                                {item.name || 'Unnamed Supplier'}
                              </Text>
                            </TouchableOpacity>
                          )}
                          ListEmptyComponent={<Text style={{ color: '#777', paddingVertical: 10 }}>No suppliers found</Text>}
                        />
                      </View>
                    </View>
                  )}

                  <Text style={{ fontSize: 12, color: '#777', marginBottom: 6 }}>Supplier Rate (RMB per $)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 7.20"
                    keyboardType="numeric"
                    value={newOrder.supplierRate}
                    onChangeText={(t) => setNewOrder({ ...newOrder, supplierRate: t })}
                  />

                  <Text style={{ fontSize: 12, color: '#777', marginBottom: 6 }}>Notes (optional)</Text>
                  <TextInput
                    style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
                    placeholder="Write notes..."
                    multiline
                    value={newOrder.notes}
                    onChangeText={(t) => setNewOrder({ ...newOrder, notes: t })}
                  />

                  <View style={[styles.card, { marginTop: 6 }]}>
                    <Text style={{ fontSize: 14, fontWeight: '900', marginBottom: 8 }}>Bill Overview</Text>

                    <View style={styles.row}>
                      <Text style={styles.label}>Customer Bill (BDT)</Text>
                      <Text style={styles.value}>{formatCurrency(customerBillBDT)}</Text>
                    </View>

                    <View style={[styles.row, { marginTop: 12 }]}>
                      <Text style={styles.label}>Supplier Bill (USD)</Text>
                      <Text style={styles.value}>{formatUSD(supplierBillUSD)}</Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                    <TouchableOpacity
                      disabled={isWorking}
                      style={[cancelBtn, { flex: 1 }, isWorking ? { opacity: 0.6 } : null]}
                      activeOpacity={0.85}
                      onPress={() => {
                        setOrderModalVisible(false);
                        resetNewOrderForm();
                      }}
                    >
                      <Icon name="close" size={18} color="#111" />
                      <Text style={btnTextDark}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      disabled={isWorking || !canSubmitOrder}
                      style={[primaryBtn(isWorking || !canSubmitOrder), { flex: 1 }]}
                      activeOpacity={0.9}
                      onPress={createOrderDual}
                    >
                      <Icon name="check-circle" size={18} color="white" />
                      <Text style={btnTextLight}>Create Order</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ height: 10 }} />
                </>
              }
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Receive Payment Modal */}
      <Modal
        visible={paymentModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: 'flex-end' }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={{ backgroundColor: 'rgba(0,0,0,0.4)', flex: 1 }} />

          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '85%' }}>
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' }}>
              <Text style={{ fontSize: 16, fontWeight: '800' }}>Receive Payment</Text>
              <Text style={{ fontSize: 12, color: '#777', marginTop: 4 }}>
                Customer debit + Bank credit will be created
              </Text>
            </View>

            <FlatList
              data={[]}
              renderItem={null}
              keyExtractor={() => 'payment-form'}
              keyboardShouldPersistTaps="always"
              contentContainerStyle={{ padding: 16 }}
              ListHeaderComponent={
                <>
                  <Text style={{ fontSize: 12, color: '#777', marginBottom: 6 }}>Payment Amount (BDT)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 5000"
                    keyboardType="numeric"
                    value={newPayment.amount}
                    onChangeText={(t) => setNewPayment({ ...newPayment, amount: t })}
                  />

                  <Text style={{ fontSize: 12, color: '#777', marginBottom: 6 }}>Select Bank</Text>
                  <TouchableOpacity
                    disabled={isWorking}
                    style={[
                      styles.input,
                      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
                      isWorking ? { opacity: 0.6 } : null,
                    ]}
                    onPress={() => setBankPickerVisible(true)}
                    activeOpacity={0.85}
                  >
                    <Text style={{ color: newPayment.bankName ? '#111' : '#999', fontWeight: '600' }}>
                      {newPayment.bankName ? newPayment.bankName : 'Tap to choose bank'}
                    </Text>
                    <Icon name="chevron-right" size={22} color="#555" />
                  </TouchableOpacity>

                  <Text style={{ fontSize: 12, color: '#777', marginBottom: 6 }}>Notes (optional)</Text>
                  <TextInput
                    style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
                    placeholder="Write notes..."
                    multiline
                    value={newPayment.notes}
                    onChangeText={(t) => setNewPayment({ ...newPayment, notes: t })}
                  />

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                    <TouchableOpacity
                      disabled={isWorking}
                      style={[cancelBtn, { flex: 1 }, isWorking ? { opacity: 0.6 } : null]}
                      activeOpacity={0.85}
                      onPress={() => {
                        setPaymentModalVisible(false);
                        resetNewPaymentForm();
                      }}
                    >
                      <Icon name="close" size={18} color="#111" />
                      <Text style={btnTextDark}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      disabled={isWorking || !canSubmitPayment}
                      style={[primaryBtn(isWorking || !canSubmitPayment), { flex: 1 }]}
                      activeOpacity={0.9}
                      onPress={receivePaymentDual}
                    >
                      <Icon name="check-circle" size={18} color="white" />
                      <Text style={btnTextLight}>Save Payment</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ height: 10 }} />
                </>
              }
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Bank picker modal */}
      <BankPickerModal
        visible={bankPickerVisible}
        onClose={() => setBankPickerVisible(false)}
        banks={banks}
        bankSearch={bankSearch}
        setBankSearch={setBankSearch}
        onSelect={(item) => {
          setNewPayment(prev => ({
            ...prev,
            bankId: item.id,
            bankName: item.name || 'Unnamed Bank',
          }));
          setBankPickerVisible(false);
          setBankSearch('');
        }}
      />

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: 'flex-end' }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={{ backgroundColor: 'rgba(0,0,0,0.4)', flex: 1 }} />

          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '85%' }}>
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="pencil" size={18} color="#111" />
                <Text style={{ fontSize: 16, fontWeight: '800' }}>
                  Edit {editingTx.type === 'order' ? 'Order' : 'Payment'}
                </Text>
              </View>

              <Text style={{ fontSize: 12, color: '#777', marginTop: 4 }}>
                {editingTx.type === 'order'
                  ? `Supplier: ${editingTx.supplierName || ''} (locked)`
                  : `Bank: ${editingTx.bankName || ''} (locked)`}
              </Text>
            </View>

            <FlatList
              data={[]}
              renderItem={null}
              keyExtractor={() => 'edit-form'}
              keyboardShouldPersistTaps="always"
              contentContainerStyle={{ padding: 16 }}
              ListHeaderComponent={
                <>
                  {editingTx.type === 'order' ? (
                    <>
                      <Text style={{ fontSize: 12, color: '#777', marginBottom: 6 }}>RMB Amount</Text>
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        value={editingTx.rmbAmount}
                        onChangeText={(t) => setEditingTx(prev => ({ ...prev, rmbAmount: t }))}
                      />

                      <Text style={{ fontSize: 12, color: '#777', marginBottom: 6 }}>Customer RMB Rate (BDT/RMB)</Text>
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        value={editingTx.customerRmbRate}
                        onChangeText={(t) => setEditingTx(prev => ({ ...prev, customerRmbRate: t }))}
                      />

                      <Text style={{ fontSize: 12, color: '#777', marginBottom: 6 }}>Supplier Rate (RMB per $)</Text>
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        value={editingTx.supplierRate}
                        onChangeText={(t) => setEditingTx(prev => ({ ...prev, supplierRate: t }))}
                      />

                      <View style={[styles.card, { marginTop: 8 }]}>
                        <Text style={{ fontSize: 14, fontWeight: '900', marginBottom: 8 }}>New Overview</Text>

                        <View style={styles.row}>
                          <Text style={styles.label}>Customer Bill (BDT)</Text>
                          <Text style={styles.value}>
                            {formatCurrency((parseFloat(editingTx.rmbAmount) || 0) * (parseFloat(editingTx.customerRmbRate) || 0))}
                          </Text>
                        </View>

                        <View style={[styles.row, { marginTop: 10 }]}>
                          <Text style={styles.label}>Supplier Bill (USD)</Text>
                          <Text style={styles.value}>
                            {formatUSD(
                              (parseFloat(editingTx.supplierRate) || 0) > 0
                                ? (parseFloat(editingTx.rmbAmount) || 0) / (parseFloat(editingTx.supplierRate) || 1)
                                : 0
                            )}
                          </Text>
                        </View>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={{ fontSize: 12, color: '#777', marginBottom: 6 }}>Payment Amount (BDT)</Text>
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        value={editingTx.amount}
                        onChangeText={(t) => setEditingTx(prev => ({ ...prev, amount: t }))}
                      />
                    </>
                  )}

                  <Text style={{ fontSize: 12, color: '#777', marginBottom: 6, marginTop: 10 }}>Notes (optional)</Text>
                  <TextInput
                    style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
                    multiline
                    value={editingTx.notes}
                    onChangeText={(t) => setEditingTx(prev => ({ ...prev, notes: t }))}
                  />

                  <Text style={{ fontSize: 12, color: '#777', marginBottom: 6, marginTop: 10 }}>Date</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    value={editingTx.date}
                    onChangeText={(t) => setEditingTx(prev => ({ ...prev, date: t }))}
                  />

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                    <TouchableOpacity
                      disabled={isWorking}
                      style={[cancelBtn, { flex: 1 }, isWorking ? { opacity: 0.6 } : null]}
                      activeOpacity={0.85}
                      onPress={() => setEditModalVisible(false)}
                    >
                      <Icon name="close" size={18} color="#111" />
                      <Text style={btnTextDark}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      disabled={isWorking}
                      style={[primaryBtn(isWorking), { flex: 1 }]}
                      activeOpacity={0.9}
                      onPress={saveEdit}
                    >
                      <Icon name="check-circle" size={18} color="white" />
                      <Text style={btnTextLight}>Save Changes</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ height: 10 }} />
                </>
              }
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
