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
          {/* Header */}
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 16, fontWeight: '800' }}>Select Bank</Text>

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

          {/* Big list (virtualized properly) */}
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

  // ✅ bank picker modal (big list safe)
  const [bankPickerVisible, setBankPickerVisible] = useState(false);
  const [bankSearch, setBankSearch] = useState('');

  const [newPayment, setNewPayment] = useState({
    amount: '',
    bankId: '',
    bankName: '',
    date: getTodayDate(),
    notes: '',
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
      // Keep flexible: show RMB suppliers or suppliers without type
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
  const customerRateNum = useMemo(
    () => parseFloat(newOrder.customerRmbRate) || 0,
    [newOrder.customerRmbRate]
  );
  const supplierRateNum = useMemo(
    () => parseFloat(newOrder.supplierRate) || 0,
    [newOrder.supplierRate]
  );

  const customerBillBDT = useMemo(
    () => rmbAmountNum * customerRateNum,
    [rmbAmountNum, customerRateNum]
  );

  const supplierBillUSD = useMemo(
    () => (supplierRateNum > 0 ? rmbAmountNum / supplierRateNum : 0),
    [rmbAmountNum, supplierRateNum]
  );

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

  const canSubmitPayment = useMemo(
    () => paymentAmountNum > 0 && !!newPayment.bankId,
    [paymentAmountNum, newPayment.bankId]
  );

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

  // ---------- Stylish Buttons (no new file) ----------
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

  // ---------- ✅ ORDER: Dual transaction (Customer + Supplier) ----------
  const createOrderDual = async () => {
    if (!canSubmitOrder) {
      Alert.alert('Missing info', 'Enter RMB amount, customer rate, select supplier, and supplier rate.');
      return;
    }

    try {
      const timestamp = new Date().toISOString();

      // 1) Supplier transaction (BILL)
      const supplierTxPayload = {
        type: 'bill',
        supplierId: newOrder.supplierId,
        supplierName: newOrder.supplierName,

        rmbAmount: rmbAmountNum,
        rate: supplierRateNum, // RMB per $
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

      // 2) Customer transaction (ORDER)
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

      // 3) Atomic balance updates
      await updateDoc(doc(db, 'customers', customer.id), {
        balance: increment(customerBillBDT),
        updatedAt: getTodayDate(),
      });

      await updateDoc(doc(db, 'suppliers', newOrder.supplierId), {
        balanceUSD: increment(supplierBillUSD),
        updatedAt: getTodayDate(),
      });

      // 4) Update local UI instantly
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
    }
  };

  // ---------- ✅ PAYMENT: Dual transaction (Customer + Bank) ----------
  const receivePaymentDual = async () => {
    if (!canSubmitPayment) {
      Alert.alert('Missing info', 'Enter amount and select a bank.');
      return;
    }

    try {
      const timestamp = new Date().toISOString();
      const amount = paymentAmountNum;

      // 1) Bank CREDIT transaction
      const bankTxPayload = {
        type: 'credit', // (or "deposit")
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

      // 2) Customer PAYMENT transaction (debit)
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

      // 3) Atomic balances
      await updateDoc(doc(db, 'customers', customer.id), {
        balance: increment(-amount),
        updatedAt: getTodayDate(),
      });

      await updateDoc(doc(db, 'banks', newPayment.bankId), {
        balance: increment(amount),
        updatedAt: getTodayDate(),
      });

      // 4) Update local UI
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
    }
  };

  // ---------- Delete (customer tx + linked tx rollback) ----------
  const deleteTransaction = (tx) => {
    Alert.alert('Delete Transaction', 'Are you sure you want to delete this transaction?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            // delete customer tx
            await deleteDoc(doc(db, `customers/${customer.id}/transactions`, tx.id));

            if (tx.type === 'order' && tx.supplierId && tx.supplierTransactionId) {
              // delete linked supplier tx + rollback supplier balance
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
              // delete linked bank tx + rollback bank balance
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
          }
        },
      },
    ]);
  };

  // ---------- UI ----------
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.customerHeader}>
        <Text style={styles.customerName}>{customerData.name}</Text>
        {customerData.phone ? <Text style={styles.customerContact}>📱 {customerData.phone}</Text> : null}

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

      {/* Action Buttons (you already have styles for these in your main styles file) */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButtonLarge, styles.orderButton]}
          onPress={() => setOrderModalVisible(true)}
        >
          <Icon name="add-shopping-cart" size={24} color="white" />
          <Text style={styles.actionButtonText}>New Order</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButtonLarge, styles.paymentButton]}
          onPress={() => setPaymentModalVisible(true)}
        >
          <Icon name="payment" size={24} color="white" />
          <Text style={styles.actionButtonText}>Receive Payment</Text>
        </TouchableOpacity>
      </View>

      {/* History header */}
      <View style={styles.transactionHeader}>
        <Text style={styles.sectionTitle}>📅 Transaction History</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
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
                <Text style={styles.transactionTypeText}>
                  {item.type === 'order' ? '📦 ORDER' : item.type === 'payment' ? '💵 PAYMENT' : 'TX'}
                </Text>
                <Text style={styles.transactionIndex}>#{index + 1}</Text>
              </View>

              <View style={styles.transactionActions}>
                <TouchableOpacity
                  style={styles.smallDeleteButton}
                  onPress={() => deleteTransaction(item)}
                >
                  <Icon name="delete" size={16} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.transactionDate}>
              📅 {item.date || ''} • 🕒{' '}
              {item.timestamp
                ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : ''}
            </Text>

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
                    <Text style={styles.notesLabel}>Note:</Text>
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
                    <Text style={styles.notesLabel}>Note:</Text>
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

      {/* ---------------- New Order Modal ---------------- */}
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
                      name={supplierDropdownOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
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
                              {!!item.type && (
                                <Text style={{ fontSize: 11, color: '#777', marginTop: 2 }}>
                                  Type: {item.type}
                                </Text>
                              )}
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
                    <Text style={{ fontSize: 11, color: '#777', marginTop: 4 }}>
                      {rmbAmountNum} RMB × {customerRateNum} = {customerBillBDT.toFixed(2)} BDT
                    </Text>

                    <View style={[styles.row, { marginTop: 12 }]}>
                      <Text style={styles.label}>Supplier Bill (USD)</Text>
                      <Text style={styles.value}>{formatUSD(supplierBillUSD)}</Text>
                    </View>
                    <Text style={{ fontSize: 11, color: '#777', marginTop: 4 }}>
                      {rmbAmountNum} RMB ÷ {supplierRateNum || 0} = {supplierBillUSD.toFixed(2)} USD
                    </Text>

                    {!!newOrder.supplierName && (
                      <Text style={{ fontSize: 11, color: '#777', marginTop: 10 }}>
                        Supplier: {newOrder.supplierName}
                      </Text>
                    )}
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                    <TouchableOpacity
                      style={[cancelBtn, { flex: 1 }]}
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
                      style={[primaryBtn(!canSubmitOrder), { flex: 1 }]}
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

      {/* ---------------- Receive Payment Modal ---------------- */}
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

                  {/* ✅ Big list safe selector: open BankPickerModal */}
                  <Text style={{ fontSize: 12, color: '#777', marginBottom: 6 }}>Select Bank</Text>
                  <TouchableOpacity
                    style={[
                      styles.input,
                      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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

                  <View style={[styles.card, { marginTop: 6 }]}>
                    <Text style={{ fontSize: 14, fontWeight: '900', marginBottom: 8 }}>Payment Overview</Text>

                    <View style={styles.row}>
                      <Text style={styles.label}>Customer Debit (BDT)</Text>
                      <Text style={styles.value}>{formatCurrency(paymentAmountNum)}</Text>
                    </View>

                    <View style={[styles.row, { marginTop: 10 }]}>
                      <Text style={styles.label}>Bank Credit (BDT)</Text>
                      <Text style={styles.value}>{formatCurrency(paymentAmountNum)}</Text>
                    </View>

                    {!!newPayment.bankName && (
                      <Text style={{ fontSize: 11, color: '#777', marginTop: 10 }}>
                        Bank: {newPayment.bankName}
                      </Text>
                    )}
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                    <TouchableOpacity
                      style={[cancelBtn, { flex: 1 }]}
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
                      style={[primaryBtn(!canSubmitPayment), { flex: 1 }]}
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

      {/* ✅ Bank picker modal (big list safe) */}
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
    </View>
  );
}
