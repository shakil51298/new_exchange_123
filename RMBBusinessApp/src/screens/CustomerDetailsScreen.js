// src/screens/CustomerDetailsScreen.js
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

import Icon from 'react-native-vector-icons/MaterialIcons';
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

export default function CustomerDetailsScreen({ route }) {
    const { customer } = route.params;

    const [customerData, setCustomerData] = useState(customer);
    const [transactions, setTransactions] = useState([]);
    const [suppliers, setSuppliers] = useState([]);

    const [orderModalVisible, setOrderModalVisible] = useState(false);
    const [paymentModalVisible, setPaymentModalVisible] = useState(false);

    const [refreshing, setRefreshing] = useState(false);

    // Supplier dropdown UI
    const [supplierDropdownOpen, setSupplierDropdownOpen] = useState(false);
    const [supplierSearch, setSupplierSearch] = useState('');

    // ✅ Single consistent shape (customerRmbRate used everywhere)
    const [newOrder, setNewOrder] = useState({
        rmbAmount: '',
        customerRmbRate: '', // BDT per RMB
        supplierId: '',
        supplierName: '',
        supplierRate: '', // RMB per $
        date: getTodayDate(),
        notes: '',
    });

    const [newPayment, setNewPayment] = useState({
        amount: '',
        date: getTodayDate(),
        notes: '',
    });

    useEffect(() => {
        loadTransactions();
        loadSuppliers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadSuppliers = async () => {
        try {
            const snap = await getDocs(collection(db, 'suppliers'));
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            // Filter RMB suppliers (your code uses type === 'RMB')
            setSuppliers(list.filter(s => s.type === 'RMB'));
        } catch (e) {
            console.error('Error loading suppliers:', e);
        }
    };

    const loadTransactions = async () => {
        try {
            const ref = collection(db, `customers/${customer.id}/transactions`);
            const snap = await getDocs(ref);
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            setTransactions(list);
            await AsyncStorage.setItem(`transactions_${customer.id}`, JSON.stringify(list));
        } catch (e) {
            console.error('Error loading transactions:', e);
            const cached = await AsyncStorage.getItem(`transactions_${customer.id}`);
            if (cached) {
                const list = JSON.parse(cached);
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

    // ---------- Calculations (live preview) ----------
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
        const q = supplierSearch.toLowerCase();
        return (suppliers || []).filter(s => (s.name || '').toLowerCase().includes(q));
    }, [suppliers, supplierSearch]);

    // ---------- Helpers ----------
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

    // ---------- ✅ FIXED: dual write + atomic balance updates ----------
    const saveDualTransaction = async () => {
        if (!canSubmitOrder) {
            Alert.alert('Missing info', 'Please enter RMB amount, customer rate, select supplier, and supplier rate.');
            return;
        }

        try {
            const timestamp = new Date().toISOString();

            // 1) Create supplier transaction first so we can store its ID in customer tx
            const supplierTxPayload = {
                type: 'bill',
                supplierId: newOrder.supplierId,
                supplierName: newOrder.supplierName,
                supplierType: 'RMB',

                // ✅ Make sure RMB is stored
                rmbAmount: rmbAmountNum,
                rate: supplierRateNum, // RMB per $
                amountUSD: supplierBillUSD,

                customerId: customer.id,
                customerName: customer.name,
                customerRmbRate: customerRateNum,

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

            // 2) Create customer transaction linked to supplier transaction
            const customerTxPayload = {
                type: 'order',
                customerId: customer.id,
                customerName: customer.name,

                rmbAmount: rmbAmountNum,
                customerRmbRate: customerRateNum, // ✅ consistent
                billBDT: customerBillBDT,

                supplierId: newOrder.supplierId,
                supplierName: newOrder.supplierName,
                supplierRate: supplierRateNum, // RMB per $

                // ✅ link info for future delete/reconcile
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

            // 3) ✅ Atomic increments (prevents overwriting / “0” bugs)
            await updateDoc(doc(db, 'customers', customer.id), {
                balance: increment(customerBillBDT),
                updatedAt: getTodayDate(),
            });

            await updateDoc(doc(db, 'suppliers', newOrder.supplierId), {
                balanceUSD: increment(supplierBillUSD),
                updatedAt: getTodayDate(),
            });

            // 4) Update local customer balance immediately
            const updatedCustomerBalance = (parseFloat(customerData.balance) || 0) + customerBillBDT;
            const updatedCustomer = { ...customerData, balance: updatedCustomerBalance };
            setCustomerData(updatedCustomer);

            // 5) Update local transactions list (customer)
            const customerTxWithId = { id: customerTxRef.id, ...customerTxPayload };
            const updatedTransactions = [customerTxWithId, ...transactions].sort(
                (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
            );
            setTransactions(updatedTransactions);
            await AsyncStorage.setItem(`transactions_${customer.id}`, JSON.stringify(updatedTransactions));

            // 6) Update AsyncStorage customers list
            const storedCustomers = await AsyncStorage.getItem('customers');
            if (storedCustomers) {
                const list = JSON.parse(storedCustomers);
                const next = list.map(c => (c.id === customer.id ? updatedCustomer : c));
                await AsyncStorage.setItem('customers', JSON.stringify(next));
            }

            // 7) Update AsyncStorage suppliers list (best-effort display)
            const storedSuppliers = await AsyncStorage.getItem('suppliers');
            if (storedSuppliers) {
                const list = JSON.parse(storedSuppliers);
                const next = list.map(s => {
                    if (s.id !== newOrder.supplierId) return s;
                    const cur = parseFloat(s.balanceUSD) || 0;
                    return { ...s, balanceUSD: cur + supplierBillUSD };
                });
                await AsyncStorage.setItem('suppliers', JSON.stringify(next));
            }

            Alert.alert('Success', 'Order created for both customer and supplier!');
            setOrderModalVisible(false);
            resetNewOrderForm();
        } catch (e) {
            console.error('Error saving dual transaction:', e);
            Alert.alert('Error', e?.message || 'Failed to create order');
        }
    };

    // ---------- ✅ Payment (customer only) ----------
    const handlePayment = async () => {
        const amt = parseFloat(newPayment.amount) || 0;
        if (amt <= 0) {
            Alert.alert('Error', 'Please enter a valid payment amount');
            return;
        }

        try {
            const timestamp = new Date().toISOString();
            const paymentTx = {
                type: 'payment',
                customerId: customer.id,
                customerName: customer.name,
                amount: amt,
                notes: newPayment.notes || '',
                date: newPayment.date || getTodayDate(),
                timestamp,
                createdAt: getTodayDate(),
            };

            const ref = await addDoc(collection(db, `customers/${customer.id}/transactions`), paymentTx);

            // Payment reduces customer balance
            await updateDoc(doc(db, 'customers', customer.id), {
                balance: increment(-amt),
                updatedAt: getTodayDate(),
            });

            const updatedCustomerBalance = (parseFloat(customerData.balance) || 0) - amt;
            const updatedCustomer = { ...customerData, balance: updatedCustomerBalance };
            setCustomerData(updatedCustomer);

            const paymentWithId = { id: ref.id, ...paymentTx };
            const updatedTransactions = [paymentWithId, ...transactions].sort(
                (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
            );
            setTransactions(updatedTransactions);
            await AsyncStorage.setItem(`transactions_${customer.id}`, JSON.stringify(updatedTransactions));

            const storedCustomers = await AsyncStorage.getItem('customers');
            if (storedCustomers) {
                const list = JSON.parse(storedCustomers);
                const next = list.map(c => (c.id === customer.id ? updatedCustomer : c));
                await AsyncStorage.setItem('customers', JSON.stringify(next));
            }

            Alert.alert('Success', 'Payment saved!');
            setPaymentModalVisible(false);
            setNewPayment({ amount: '', date: getTodayDate(), notes: '' });
        } catch (e) {
            console.error('Payment save failed:', e);
            Alert.alert('Error', e?.message || 'Failed to save payment');
        }
    };

    // ---------- Optional: delete customer tx (and linked supplier tx if order) ----------
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
                            // delete linked supplier tx
                            await deleteDoc(doc(db, `suppliers/${tx.supplierId}/transactions`, tx.supplierTransactionId));

                            // reverse supplier balance
                            const usd = parseFloat(tx.supplierAmountUSD) || 0;
                            await updateDoc(doc(db, 'suppliers', tx.supplierId), {
                                balanceUSD: increment(-usd),
                                updatedAt: getTodayDate(),
                            });
                        }

                        // reverse customer balance
                        if (tx.type === 'order') {
                            const bdt = parseFloat(tx.billBDT) || 0;
                            await updateDoc(doc(db, 'customers', customer.id), {
                                balance: increment(-bdt),
                                updatedAt: getTodayDate(),
                            });
                            setCustomerData(prev => ({ ...prev, balance: (parseFloat(prev.balance) || 0) - bdt }));
                        } else if (tx.type === 'payment') {
                            const amt = parseFloat(tx.amount) || 0;
                            await updateDoc(doc(db, 'customers', customer.id), {
                                balance: increment(amt),
                                updatedAt: getTodayDate(),
                            });
                            setCustomerData(prev => ({ ...prev, balance: (parseFloat(prev.balance) || 0) + amt }));
                        }

                        const next = transactions.filter(t => t.id !== tx.id).sort(
                            (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
                        );
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
            <View style={styles.customerHeader}>
                <Text style={styles.customerName}>{customerData.name}</Text>
                {customerData.phone && <Text style={styles.customerContact}>📱 {customerData.phone}</Text>}

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

            <View style={styles.transactionHeader}>
                <Text style={styles.sectionTitle}>📅 Transaction History</Text>
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
                    <View style={styles.transactionCard}>
                        <View style={styles.transactionHeaderRow}>
                            <View style={styles.transactionTypeBadge}>
                                <Text style={styles.transactionTypeText}>
                                    {item.type === 'order' ? '📦 ORDER' : '💵 PAYMENT'}
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
                            📅 {item.date} • 🕒{' '}
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

                                {item.supplierName ? (
                                    <View style={styles.transactionRow}>
                                        <Text style={styles.transactionLabel}>Supplier:</Text>
                                        <Text style={styles.transactionValue}>{item.supplierName}</Text>
                                    </View>
                                ) : null}

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
                        ) : (
                            <View style={styles.transactionDetails}>
                                <View style={styles.transactionRow}>
                                    <Text style={styles.transactionLabel}>Payment Amount:</Text>
                                    <Text style={[styles.transactionValue, styles.boldText]}>
                                        {formatCurrency(item.amount)}
                                    </Text>
                                </View>

                                {item.notes ? (
                                    <View style={styles.notesContainer}>
                                        <Text style={styles.notesLabel}>Note:</Text>
                                        <Text style={styles.notesText}>{item.notes}</Text>
                                    </View>
                                ) : null}
                            </View>
                        )}

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
                            <Text style={{ fontSize: 16, fontWeight: '700' }}>New Order</Text>
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
                                        style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                                        onPress={() => setSupplierDropdownOpen(!supplierDropdownOpen)}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={{ color: newOrder.supplierName ? '#111' : '#999' }}>
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
                                                            <Text style={{ fontWeight: '600', color: '#111' }}>
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
                                        <Text style={{ fontSize: 14, fontWeight: '700', marginBottom: 8 }}>Bill Overview</Text>

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

                                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                                        <TouchableOpacity
                                            style={[styles.btn, { backgroundColor: '#6c757d', flex: 1 }]}
                                            onPress={() => {
                                                setOrderModalVisible(false);
                                                resetNewOrderForm();
                                            }}
                                        >
                                            <Text style={styles.btnText}>Cancel</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[styles.btn, { flex: 1 }]}
                                            onPress={saveDualTransaction}
                                        >
                                            <Text style={styles.btnText}>Create Order</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <View style={{ height: 10 }} />
                                </>
                            }
                        />
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* ---------------- Payment Modal ---------------- */}
            <Modal
                animationType="slide"
                transparent
                visible={paymentModalVisible}
                onRequestClose={() => setPaymentModalVisible(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>💵 Receive Payment</Text>

                        <TextInput
                            style={styles.input}
                            placeholder="Amount (BDT)"
                            value={newPayment.amount}
                            onChangeText={(text) => setNewPayment({ ...newPayment, amount: text })}
                            keyboardType="numeric"
                        />

                        <TextInput
                            style={[styles.input, styles.textArea]}
                            placeholder="Notes (Optional)"
                            value={newPayment.notes}
                            onChangeText={(text) => setNewPayment({ ...newPayment, notes: text })}
                            multiline
                            numberOfLines={3}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setPaymentModalVisible(false)}
                            >
                                <Text style={styles.modalButtonText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalButton, styles.saveButton]}
                                onPress={handlePayment}
                            >
                                <Text style={styles.modalButtonText}>Save Payment</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}
