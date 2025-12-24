// src/screens/CustomerDetailsScreen.js
import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    ScrollView,
    FlatList,
    TouchableOpacity,
    Modal,
    Alert,
    KeyboardAvoidingView,
    Platform,
  } from 'react-native';
  
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore';

import { db } from '../config/firebase';
import styles from '../styles/styles';

import { formatCurrency } from '../utils/format';
import { getTodayDate } from '../utils/date';

export default function CustomerDetailsScreen({ route, navigation }) {
    const { customer } = route.params;
    const [customerData, setCustomerData] = useState(customer);
    const [transactions, setTransactions] = useState([]);
    const [orderModalVisible, setOrderModalVisible] = useState(false);
    const [paymentModalVisible, setPaymentModalVisible] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [suppliers, setSuppliers] = useState([]);
    const [selectedSupplier, setSelectedSupplier] = useState(null);
  
    const [newOrder, setNewOrder] = useState({
      rmbAmount: '',
      supplierRate: '', // Supplier's rate (RMB per $)
      customerRate: '', // Customer rate (BDT per RMB)
      supplierId: '',
      supplierName: '',
      date: getTodayDate(),
      notes: '',
    });
    
    const [newPayment, setNewPayment] = useState({
      amount: '',
      date: getTodayDate(),
      notes: '',
    });
    
    const [editingTransaction, setEditingTransaction] = useState({
      id: '',
      type: '',
      rmbAmount: '',
      rate: '',
      billBDT: '',
      amount: '',
      notes: '',
      date: getTodayDate(),
      timestamp: '',
    });
  
    const [refreshing, setRefreshing] = useState(false);
  
    useEffect(() => {
      loadTransactions();
      loadSuppliers();
    }, []);
  
    const loadSuppliers = async () => {
      try {
        const suppliersSnapshot = await getDocs(collection(db, 'suppliers'));
        const suppliersList = [];
        suppliersSnapshot.forEach((doc) => {
          suppliersList.push({ id: doc.id, ...doc.data() });
        });
        // Filter only RMB suppliers
        const rmbSuppliers = suppliersList.filter(s => s.type === 'RMB');
        setSuppliers(rmbSuppliers);
      } catch (error) {
        console.error('Error loading suppliers:', error);
      }
    };
  
    const loadTransactions = async () => {
      try {
        // Try to load from Firestore first
        const transactionsRef = collection(db, `customers/${customer.id}/transactions`);
        const querySnapshot = await getDocs(transactionsRef);
        const transactionsList = [];
        querySnapshot.forEach((doc) => {
          transactionsList.push({ id: doc.id, ...doc.data() });
        });
        // Sort by date descending (newest first)
        transactionsList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setTransactions(transactionsList);
        // Also save to AsyncStorage for backup
        await AsyncStorage.setItem(`transactions_${customer.id}`, JSON.stringify(transactionsList));
      } catch (error) {
        console.error('Error loading transactions from Firestore:', error);
        // Fallback to AsyncStorage
        const storedTransactions = await AsyncStorage.getItem(`transactions_${customer.id}`);
        if (storedTransactions) {
          const transactionsList = JSON.parse(storedTransactions);
          transactionsList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          setTransactions(transactionsList);
        }
      }
    };
  
    const onRefresh = async () => {
      setRefreshing(true);
      await loadTransactions();
      setRefreshing(false);
    };
  
    // const saveTransaction = async (type, data, isEdit = false) => {
    //   try {
    //     const newTransaction = {
    //       customerId: customer.id,
    //       customerName: customer.name,
    //       type: type, // 'order' or 'payment'
    //       ...data,
    //       date: data.date || getTodayDate(),
    //       timestamp: isEdit ? (editingTransaction.timestamp || new Date().toISOString()) : new Date().toISOString(),
    //     };
  
    //     // Remove undefined values
    //     Object.keys(newTransaction).forEach(key => {
    //       if (newTransaction[key] === undefined) {
    //         delete newTransaction[key];
    //       }
    //     });
  
    //     let balanceChange = 0;
    //     if (type === 'order') {
    //       balanceChange = (parseFloat(data.rmbAmount) || 0) * (parseFloat(data.supplierRate) || 0);
    //       // Also create supplier transaction if supplier is selected
    //       if (data.supplierId) {
    //         await createSupplierTransaction(data);
    //       }
    //     } else if (type === 'payment') {
    //       balanceChange = -(parseFloat(data.amount) || 0);
    //     }
  
    //     const currentBalance = parseFloat(customerData.balance) || 0;
    //     const newBalance = currentBalance + balanceChange;
  
    //     if (isEdit && editingTransaction.id) {
    //       // For edits, reverse old transaction first
    //       const oldTransaction = transactions.find(t => t.id === editingTransaction.id);
    //       let oldBalanceChange = 0;
          
    //       if (oldTransaction.type === 'order') {
    //         oldBalanceChange = -(oldTransaction.billBDT || 0); // Reverse old order
    //       } else if (oldTransaction.type === 'payment') {
    //         oldBalanceChange = oldTransaction.amount || 0; // Reverse old payment
    //       }
          
    //       // Calculate with reversed old transaction
    //       const balanceAfterReverse = currentBalance + oldBalanceChange;
    //       const finalBalance = balanceAfterReverse + balanceChange;
          
    //       // Update in Firestore
    //       const updateData = { ...newTransaction };
    //       delete updateData.id;
    //       delete updateData.createdAt;
          
    //       await updateDoc(doc(db, `customers/${customer.id}/transactions`, editingTransaction.id), updateData);
          
    //       // Update local state - NEWEST FIRST
    //       const updatedTransactions = transactions.map(t => 
    //         t.id === editingTransaction.id ? { ...t, ...newTransaction } : t
    //       );
    //       updatedTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    //       setTransactions(updatedTransactions);
          
    //       // Also save to AsyncStorage
    //       await AsyncStorage.setItem(`transactions_${customer.id}`, JSON.stringify(updatedTransactions));
          
    //       // Update customer balance
    //       const updatedCustomer = { ...customerData, balance: finalBalance };
    //       setCustomerData(updatedCustomer);
          
    //       // Update in Firestore customers collection
    //       await updateDoc(doc(db, 'customers', customer.id), { 
    //         balance: finalBalance, 
    //         updatedAt: getTodayDate() 
    //       });
          
    //       // Update in AsyncStorage customers list
    //       const storedCustomers = await AsyncStorage.getItem('customers');
    //       if (storedCustomers) {
    //         const customers = JSON.parse(storedCustomers);
    //         const updatedCustomers = customers.map(c => 
    //           c.id === customer.id ? updatedCustomer : c
    //         );
    //         await AsyncStorage.setItem('customers', JSON.stringify(updatedCustomers));
    //       }
    //     } else {
    //       // For new transactions - add createdAt
    //       newTransaction.createdAt = getTodayDate();
          
    //       // Save to Firestore
    //       const docRef = await addDoc(collection(db, `customers/${customer.id}/transactions`), newTransaction);
    //       const transactionWithId = { id: docRef.id, ...newTransaction };
          
    //       // Add at beginning and sort by timestamp (newest first)
    //       const updatedTransactions = [transactionWithId, ...transactions];
    //       updatedTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    //       setTransactions(updatedTransactions);
          
    //       // Also save to AsyncStorage
    //       await AsyncStorage.setItem(`transactions_${customer.id}`, JSON.stringify(updatedTransactions));
  
    //       // Update customer balance
    //       const updatedCustomer = { ...customerData, balance: newBalance };
    //       setCustomerData(updatedCustomer);
  
    //       // Update in Firestore customers collection
    //       await updateDoc(doc(db, 'customers', customer.id), { 
    //         balance: newBalance,
    //         updatedAt: getTodayDate() 
    //       });
          
    //       // Update in AsyncStorage customers list
    //       const storedCustomers = await AsyncStorage.getItem('customers');
    //       if (storedCustomers) {
    //         const customers = JSON.parse(storedCustomers);
    //         const updatedCustomers = customers.map(c => 
    //           c.id === customer.id ? updatedCustomer : c
    //         );
    //         await AsyncStorage.setItem('customers', JSON.stringify(updatedCustomers));
    //       }
    //     }
  
    //     Alert.alert('Success', `${isEdit ? 'Transaction updated' : 'Transaction saved'} to cloud!`);
        
    //     // Reset forms
    //     if (type === 'order') {
    //       setOrderModalVisible(false);
    //       setNewOrder({ 
    //         rmbAmount: '', 
    //         supplierId: '', 
    //         supplierName: '', 
    //         supplierRate: '', 
    //         date: getTodayDate(), 
    //         notes: '' 
    //       });
    //     } else if (type === 'payment') {
    //       setPaymentModalVisible(false);
    //       setNewPayment({ amount: '', date: getTodayDate(), notes: '' });
    //     }
    //     if (isEdit) {
    //       setEditModalVisible(false);
    //       setEditingTransaction({ 
    //         id: '', type: '', rmbAmount: '', supplierId: '', supplierName: '', 
    //         supplierRate: '', billBDT: '', amount: '', notes: '', date: getTodayDate(), timestamp: '' 
    //       });
    //     }
    //   } catch (error) {
    //     console.error('Error saving transaction:', error);
    //     Alert.alert('Error', `Failed to save: ${error.message}`);
    //     // Fallback to AsyncStorage only
    //     handleLocalSave(type, data, isEdit);
    //   }
    // };
  // NEW FUNCTION: Save transaction to BOTH customer and supplier
  const saveDualTransaction = async (customerTransactionData, supplierTransactionData) => {
    try {
      const timestamp = new Date().toISOString();
      
      // 1. Save to Customer's transactions
      const customerDocRef = await addDoc(
        collection(db, `customers/${customer.id}/transactions`), 
        customerTransactionData
      );
      
      // 2. Save to Supplier's transactions
      const supplierDocRef = await addDoc(
        collection(db, `suppliers/${newOrder.supplierId}/transactions`), 
        supplierTransactionData
      );
      
      // 3. Update Customer balance
      const customerBalanceChange = customerTransactionData.billBDT || 0;
      const currentCustomerBalance = parseFloat(customerData.balance) || 0;
      const newCustomerBalance = currentCustomerBalance + customerBalanceChange;
      
      await updateDoc(doc(db, 'customers', customer.id), { 
        balance: newCustomerBalance,
        updatedAt: getTodayDate()
      });
      
      // 4. Update Supplier balance
      const supplierBalanceChange = supplierTransactionData.amountUSD || 0;
      const currentSupplierBalance = parseFloat(selectedSupplier?.balanceUSD) || 0;
      const newSupplierBalance = currentSupplierBalance + supplierBalanceChange;
      
      await updateDoc(doc(db, 'suppliers', newOrder.supplierId), { 
        balanceUSD: newSupplierBalance,
        updatedAt: getTodayDate()
      });
      
      // Update local states
      const updatedCustomer = { ...customerData, balance: newCustomerBalance };
      setCustomerData(updatedCustomer);
      
      // Update customer transactions list
      const customerTransactionWithId = { 
        id: customerDocRef.id, 
        ...customerTransactionData 
      };
      const updatedCustomerTransactions = [customerTransactionWithId, ...transactions];
      updatedCustomerTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setTransactions(updatedCustomerTransactions);
      
      // Save to AsyncStorage
      await AsyncStorage.setItem(`transactions_${customer.id}`, JSON.stringify(updatedCustomerTransactions));
      
      // Update customers list in AsyncStorage
      const storedCustomers = await AsyncStorage.getItem('customers');
      if (storedCustomers) {
        const customersList = JSON.parse(storedCustomers);
        const updatedCustomersList = customersList.map(c => 
          c.id === customer.id ? updatedCustomer : c
        );
        await AsyncStorage.setItem('customers', JSON.stringify(updatedCustomersList));
      }
      
      // Update suppliers list in AsyncStorage
      const storedSuppliers = await AsyncStorage.getItem('suppliers');
      if (storedSuppliers) {
        const suppliersList = JSON.parse(storedSuppliers);
        const updatedSuppliersList = suppliersList.map(s => 
          s.id === newOrder.supplierId ? { ...s, balanceUSD: newSupplierBalance } : s
        );
        await AsyncStorage.setItem('suppliers', JSON.stringify(updatedSuppliersList));
      }
      
      Alert.alert('Success', 'Order created for both customer and supplier!');
      setOrderModalVisible(false);
      resetNewOrderForm();
      
    } catch (error) {
      console.error('Error saving dual transaction:', error);
      Alert.alert('Error', `Failed to save: ${error.message}`);
      // Fallback to local save
      saveDualTransactionLocally(customerTransactionData, supplierTransactionData);
    }
  };
  
  const saveDualTransactionLocally = async (customerTransactionData, supplierTransactionData) => {
    const timestamp = new Date().toISOString();
    
    // Customer transaction
    const customerTransaction = {
      id: Date.now().toString(),
      ...customerTransactionData,
      timestamp: timestamp,
    };
    
    // Supplier transaction
    const supplierTransaction = {
      id: `supplier_${Date.now().toString()}`,
      ...supplierTransactionData,
      timestamp: timestamp,
    };
    // Update customer locally
    const customerBalanceChange = customerTransactionData.billBDT || 0;
    const currentCustomerBalance = parseFloat(customerData.balance) || 0;
    const newCustomerBalance = currentCustomerBalance + customerBalanceChange;
    const updatedCustomer = { ...customerData, balance: newCustomerBalance };
    setCustomerData(updatedCustomer);
    
    // Update customer transactions
    const updatedCustomerTransactions = [customerTransaction, ...transactions];
    updatedCustomerTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    setTransactions(updatedCustomerTransactions);
      
      // Save to AsyncStorage
      await AsyncStorage.setItem(`transactions_${customer.id}`, JSON.stringify(updatedCustomerTransactions));
      
      // Update customers list
      const storedCustomers = await AsyncStorage.getItem('customers');
      if (storedCustomers) {
        const customersList = JSON.parse(storedCustomers);
        const updatedCustomersList = customersList.map(c => 
          c.id === customer.id ? updatedCustomer : c
        );
        await AsyncStorage.setItem('customers', JSON.stringify(updatedCustomersList));
      }
      
      // Update supplier locally
      const supplierBalanceChange = supplierTransactionData.amountUSD || 0;
      const storedSuppliers = await AsyncStorage.getItem('suppliers');
      if (storedSuppliers) {
        const suppliersList = JSON.parse(storedSuppliers);
        const updatedSuppliersList = suppliersList.map(s => {
          if (s.id === newOrder.supplierId) {
            const currentBalance = parseFloat(s.balanceUSD) || 0;
            return { 
              ...s, 
              balanceUSD: currentBalance + supplierBalanceChange 
            };
          }
          return s;
        });
        await AsyncStorage.setItem('suppliers', JSON.stringify(updatedSuppliersList));
      }
      
      Alert.alert('Saved locally', 'Order saved to device storage');
      setOrderModalVisible(false);
      resetNewOrderForm();
    };
    const resetNewOrderForm = () => {
      setNewOrder({
        rmbAmount: '',
        supplierRate: '',
        customerRate: '',
        supplierId: '',
        supplierName: '',
        date: getTodayDate(),
        notes: '',
      });
      setSelectedSupplier(null);
    };
    const handleNewOrder = () => {
      if (!newOrder.rmbAmount) {
        Alert.alert('Error', 'Please enter RMB amount');
        return;
      }
      
      if (!newOrder.supplierId) {
        Alert.alert('Error', 'Please select a supplier');
        return;
      }
      
      if (!newOrder.supplierRate) {
        Alert.alert('Error', 'Please enter supplier rate (RMB per $)');
        return;
      }
      
      if (!newOrder.customerRate) {
        Alert.alert('Error', 'Please enter customer rate (BDT per RMB)');
        return;
      }
      
      const rmbAmount = parseFloat(newOrder.rmbAmount) || 0;
      const supplierRate = parseFloat(newOrder.supplierRate) || 0;
      const customerRate = parseFloat(newOrder.customerRate) || 0;
      
      // Calculate amounts
      const amountUSD = supplierRate > 0 ? rmbAmount / supplierRate : 0; // For supplier
      const billBDT = rmbAmount * customerRate; // For customer
      
      // Prepare customer transaction data
      const customerTransactionData = {
        customerId: customer.id,
        customerName: customer.name,
        type: 'order',
        rmbAmount: rmbAmount,
        rate: customerRate,
        billBDT: billBDT,
        supplierId: newOrder.supplierId,
        supplierName: newOrder.supplierName,
        supplierRate: supplierRate,
        notes: newOrder.notes || '',
        date: newOrder.date || getTodayDate(),
        timestamp: new Date().toISOString(),
        createdAt: getTodayDate(),
      };
      
      // Prepare supplier transaction data
      const supplierTransactionData = {
        supplierId: newOrder.supplierId,
        supplierName: newOrder.supplierName,
        supplierType: 'RMB',
        type: 'bill',
        rmbAmount: rmbAmount,
        rate: supplierRate,
        amountUSD: amountUSD,
        customerId: customer.id,
        customerName: customer.name,
        customerRate: customerRate,
        calculation: `${rmbAmount} RMB ÷ ${supplierRate} = ${amountUSD.toFixed(2)} USD`,
        notes: newOrder.notes || '',
        date: newOrder.date || getTodayDate(),
        timestamp: new Date().toISOString(),
        createdAt: getTodayDate(),
      };
      
      saveDualTransaction(customerTransactionData, supplierTransactionData);
    };
  
    const createSupplierTransaction = async (orderData) => {
      try {
        const rmbAmount = parseFloat(orderData.rmbAmount) || 0;
        const supplierRate = parseFloat(orderData.supplierRate) || 0;
        const amountUSD = rmbAmount / supplierRate;
        
        const supplierTransaction = {
          customerId: customer.id,
          customerName: customer.name,
          supplierId: orderData.supplierId,
          supplierName: orderData.supplierName,
          supplierType: 'RMB',
          type: 'bill',
          rmbAmount: rmbAmount,
          rate: supplierRate,
          amountUSD: amountUSD,
          description: `Order from ${customer.name}: ${rmbAmount} RMB`,
          date: orderData.date || getTodayDate(),
          calculation: `${rmbAmount} RMB / ${supplierRate} = ${amountUSD.toFixed(2)} USD`,
          createdAt: getTodayDate(),
          timestamp: new Date().toISOString(),
        };
  
        // Save to supplier's transaction collection
        await addDoc(collection(db, `suppliers/${orderData.supplierId}/transactions`), supplierTransaction);
        
        // Update supplier balance
        const supplier = suppliers.find(s => s.id === orderData.supplierId);
        if (supplier) {
          const currentBalanceUSD = parseFloat(supplier.balanceUSD) || 0;
          const newBalanceUSD = currentBalanceUSD + amountUSD;
          
          await updateDoc(doc(db, 'suppliers', orderData.supplierId), { 
            balanceUSD: newBalanceUSD,
            updatedAt: getTodayDate()
          });
          
          // Update local suppliers state
          const updatedSuppliers = suppliers.map(s => 
            s.id === orderData.supplierId ? { ...s, balanceUSD: newBalanceUSD } : s
          );
          setSuppliers(updatedSuppliers);
        }
        
        console.log('Supplier transaction created successfully');
      } catch (error) {
        console.error('Error creating supplier transaction:', error);
        // Don't fail the customer transaction if supplier update fails
        Alert.alert('Warning', 'Customer order saved but supplier update failed');
      }
    };
  
    const handleLocalSave = async (type, data, isEdit = false) => {
      const newTransaction = {
        id: isEdit ? editingTransaction.id : Date.now().toString(),
        customerId: customer.id,
        customerName: customer.name,
        type: type, // 'order' or 'payment'
        ...data,
        date: data.date || getTodayDate(),
        timestamp: isEdit ? (editingTransaction.timestamp || new Date().toISOString()) : new Date().toISOString(),
      };
  
      // For new transactions, add createdAt
      if (!isEdit) {
        newTransaction.createdAt = getTodayDate();
      }
  
      let updatedTransactions;
      if (isEdit) {
        updatedTransactions = transactions.map(t => 
          t.id === editingTransaction.id ? newTransaction : t
        );
      } else {
        updatedTransactions = [newTransaction, ...transactions];
      }
      
      // Sort by timestamp (newest first)
      updatedTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setTransactions(updatedTransactions);
      await AsyncStorage.setItem(`transactions_${customer.id}`, JSON.stringify(updatedTransactions));
  
      // Update customer balance locally
      let balanceChange = 0;
      if (type === 'order') {
        balanceChange = (parseFloat(data.rmbAmount) || 0) * (parseFloat(data.supplierRate) || 0);
        // Also save supplier transaction locally if supplier selected
        if (data.supplierId) {
          saveSupplierTransactionLocally(data);
        }
      } else if (type === 'payment') {
        balanceChange = -(parseFloat(data.amount) || 0);
      }
  
      const currentBalance = parseFloat(customerData.balance) || 0;
      const newBalance = currentBalance + balanceChange;
      const updatedCustomer = { ...customerData, balance: newBalance };
      setCustomerData(updatedCustomer);
  
      // Update in main customers list locally
      const storedCustomers = await AsyncStorage.getItem('customers');
      if (storedCustomers) {
        const customers = JSON.parse(storedCustomers);
        const updatedCustomers = customers.map(c => 
          c.id === customer.id ? updatedCustomer : c
        );
        await AsyncStorage.setItem('customers', JSON.stringify(updatedCustomers));
      }
  
      Alert.alert('Saved locally', `${isEdit ? 'Transaction updated' : 'Transaction saved'} to device`);
      
      // Reset forms
      if (type === 'order') {
        setOrderModalVisible(false);
        setNewOrder({ 
          rmbAmount: '', 
          supplierId: '', 
          supplierName: '', 
          supplierRate: '', 
          date: getTodayDate(), 
          notes: '' 
        });
      } else if (type === 'payment') {
        setPaymentModalVisible(false);
        setNewPayment({ amount: '', date: getTodayDate(), notes: '' });
      }
      if (isEdit) {
        setEditModalVisible(false);
        setEditingTransaction({ 
          id: '', type: '', rmbAmount: '', supplierId: '', supplierName: '', 
          supplierRate: '', billBDT: '', amount: '', notes: '', date: getTodayDate(), timestamp: '' 
        });
      }
    };
  
    const saveSupplierTransactionLocally = async (orderData) => {
      try {
        const rmbAmount = parseFloat(orderData.rmbAmount) || 0;
        const supplierRate = parseFloat(orderData.supplierRate) || 0;
        const amountUSD = rmbAmount / supplierRate;
        
        const supplierTransaction = {
          id: Date.now().toString(),
          customerId: customer.id,
          customerName: customer.name,
          supplierId: orderData.supplierId,
          supplierName: orderData.supplierName,
          supplierType: 'RMB',
          type: 'bill',
          rmbAmount: rmbAmount,
          rate: supplierRate,
          amountUSD: amountUSD,
          description: `Order from ${customer.name}: ${rmbAmount} RMB`,
          date: orderData.date || getTodayDate(),
          calculation: `${rmbAmount} RMB / ${supplierRate} = ${amountUSD.toFixed(2)} USD`,
          createdAt: getTodayDate(),
          timestamp: new Date().toISOString(),
        };
  
        // Save to local storage
        const storedTransactions = await AsyncStorage.getItem(`supplier_transactions_${orderData.supplierId}`);
        const transactions = storedTransactions ? JSON.parse(storedTransactions) : [];
        transactions.push(supplierTransaction);
        await AsyncStorage.setItem(`supplier_transactions_${orderData.supplierId}`, JSON.stringify(transactions));
        
        // Update supplier balance locally
        const supplier = suppliers.find(s => s.id === orderData.supplierId);
        if (supplier) {
          const currentBalanceUSD = parseFloat(supplier.balanceUSD) || 0;
          const newBalanceUSD = currentBalanceUSD + amountUSD;
          
          const updatedSuppliers = suppliers.map(s => 
            s.id === orderData.supplierId ? { ...s, balanceUSD: newBalanceUSD } : s
          );
          setSuppliers(updatedSuppliers);
          
          // Update in main suppliers list locally
          const storedSuppliers = await AsyncStorage.getItem('suppliers');
          if (storedSuppliers) {
            const suppliersList = JSON.parse(storedSuppliers);
            const updatedSuppliersList = suppliersList.map(s => 
              s.id === orderData.supplierId ? { ...s, balanceUSD: newBalanceUSD } : s
            );
            await AsyncStorage.setItem('suppliers', JSON.stringify(updatedSuppliersList));
          }
        }
      } catch (error) {
        console.error('Error saving supplier transaction locally:', error);
      }
    };
  
    // const handleNewOrder = () => {
    //   if (!newOrder.rmbAmount) {
    //     Alert.alert('Error', 'Please enter RMB amount');
    //     return;
    //   }
      
    //   if (!newOrder.supplierId || !newOrder.supplierRate) {
    //     Alert.alert('Error', 'Please select a supplier and enter supplier rate');
    //     return;
    //   }
      
    //   const billBDT = (parseFloat(newOrder.rmbAmount) || 0) * (parseFloat(newOrder.supplierRate) || 0);
    //   saveTransaction('order', {
    //     ...newOrder,
    //     billBDT: billBDT,
    //     rmbAmount: parseFloat(newOrder.rmbAmount),
    //     supplierRate: parseFloat(newOrder.supplierRate),
    //     notes: newOrder.notes || '',
    //   });
    // };
  
    const handlePayment = () => {
      if (!newPayment.amount) {
        Alert.alert('Error', 'Please enter payment amount');
        return;
      }
      
      saveTransaction('payment', {
        ...newPayment,
        amount: parseFloat(newPayment.amount),
        notes: newPayment.notes || '',
      });
    };
  
    const handleUpdateTransaction = () => {
      if (editingTransaction.type === 'order') {
        if (!editingTransaction.rmbAmount || !editingTransaction.supplierRate) {
          Alert.alert('Error', 'Please enter RMB amount and supplier rate');
          return;
        }
        
        const billBDT = (parseFloat(editingTransaction.rmbAmount) || 0) * (parseFloat(editingTransaction.supplierRate) || 0);
        saveTransaction('order', {
          rmbAmount: parseFloat(editingTransaction.rmbAmount),
          supplierId: editingTransaction.supplierId,
          supplierName: editingTransaction.supplierName,
          supplierRate: parseFloat(editingTransaction.supplierRate),
          billBDT: billBDT,
          notes: editingTransaction.notes || '',
          date: editingTransaction.date,
        }, true);
      } else if (editingTransaction.type === 'payment') {
        if (!editingTransaction.amount) {
          Alert.alert('Error', 'Please enter payment amount');
          return;
        }
        
        saveTransaction('payment', {
          amount: parseFloat(editingTransaction.amount),
          notes: editingTransaction.notes || '',
          date: editingTransaction.date,
        }, true);
      }
    };
  
    const editTransaction = (transaction) => {
      setEditingTransaction({
        id: transaction.id,
        type: transaction.type,
        rmbAmount: transaction.rmbAmount?.toString() || '',
        supplierId: transaction.supplierId || '',
        supplierName: transaction.supplierName || '',
        supplierRate: transaction.supplierRate?.toString() || '',
        billBDT: transaction.billBDT?.toString() || '',
        amount: transaction.amount?.toString() || '',
        notes: transaction.notes || '',
        date: transaction.date || getTodayDate(),
        timestamp: transaction.timestamp,
      });
      setEditModalVisible(true);
    };
  
    const deleteTransaction = (transactionId, transactionType, amount) => {
      Alert.alert(
        'Delete Transaction',
        'Are you sure you want to delete this transaction?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                // Delete from Firestore
                await deleteDoc(doc(db, `customers/${customer.id}/transactions`, transactionId));
                
                const updatedTransactions = transactions.filter(t => t.id !== transactionId);
                updatedTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                setTransactions(updatedTransactions);
                await AsyncStorage.setItem(`transactions_${customer.id}`, JSON.stringify(updatedTransactions));
                
                // Update customer balance (reverse the transaction)
                const balanceChange = transactionType === 'order' 
                  ? -(parseFloat(amount) || 0)
                  : (parseFloat(amount) || 0);
                
                const currentBalance = parseFloat(customerData.balance) || 0;
                const newBalance = currentBalance + balanceChange;
                const updatedCustomer = { ...customerData, balance: newBalance };
                setCustomerData(updatedCustomer);
                
                // Update in Firestore
                await updateDoc(doc(db, 'customers', customer.id), { 
                  balance: newBalance,
                  updatedAt: getTodayDate()
                });
                
                // Update in AsyncStorage
                const storedCustomers = await AsyncStorage.getItem('customers');
                if (storedCustomers) {
                  const customers = JSON.parse(storedCustomers);
                  const updatedCustomers = customers.map(c => 
                    c.id === customer.id ? updatedCustomer : c
                  );
                  await AsyncStorage.setItem('customers', JSON.stringify(updatedCustomers));
                }
                
                Alert.alert('Success', 'Transaction deleted from cloud!');
              } catch (error) {
                console.error('Error deleting transaction:', error);
                // Fallback to AsyncStorage
                const updatedTransactions = transactions.filter(t => t.id !== transactionId);
                updatedTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                setTransactions(updatedTransactions);
                await AsyncStorage.setItem(`transactions_${customer.id}`, JSON.stringify(updatedTransactions));
                
                // Update balance locally
                const balanceChange = transactionType === 'order' 
                  ? -(parseFloat(amount) || 0)
                  : (parseFloat(amount) || 0);
                
                const currentBalance = parseFloat(customerData.balance) || 0;
                const newBalance = currentBalance + balanceChange;
                const updatedCustomer = { ...customerData, balance: newBalance };
                setCustomerData(updatedCustomer);
                
                // Update locally
                const storedCustomers = await AsyncStorage.getItem('customers');
                if (storedCustomers) {
                  const customers = JSON.parse(storedCustomers);
                  const updatedCustomers = customers.map(c => 
                    c.id === customer.id ? updatedCustomer : c
                  );
                  await AsyncStorage.setItem('customers', JSON.stringify(updatedCustomers));
                }
                
                Alert.alert('Deleted locally', 'Transaction deleted from device');
              }
            },
          },
        ]
      );
    };
  
    const handleSupplierSelect = (supplierId) => {
      const selectedSupplier = suppliers.find(s => s.id === supplierId);
      if (selectedSupplier) {
        setNewOrder({
          ...newOrder,
          supplierId: selectedSupplier.id,
          supplierName: selectedSupplier.name,
        });
      }
    };
    const renderSupplierDropdown = () => {
      return (
        <View style={styles.dropdownContainer}>
          <Text style={styles.dropdownLabel}>Select Supplier:</Text>
          <ScrollView 
            style={styles.supplierList}
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={false}
            maximumZoomScale={1}
          >
            {suppliers.map(supplier => (
              <TouchableOpacity
                key={supplier.id}
                style={[
                  styles.supplierItem,
                  selectedSupplier?.id === supplier.id && styles.supplierItemSelected
                ]}
                onPress={() => {
                  setSelectedSupplier(supplier);
                  setNewOrder({
                    ...newOrder,
                    supplierId: supplier.id,
                    supplierName: supplier.name,
                  });
                }}
              >
                <Text style={[
                  styles.supplierItemText,
                  selectedSupplier?.id === supplier.id && styles.supplierItemTextSelected
                ]}>
                  {supplier.name} (Balance: {formatUSD(supplier.balanceUSD || 0)})
                </Text>
                {selectedSupplier?.id === supplier.id && (
                  <Icon name="check" size={16} color="#28a745" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
          {selectedSupplier && (
            <Text style={styles.selectedSupplierText}>
              Selected: {selectedSupplier.name}
            </Text>
          )}
        </View>
      );
    };
  
    return (
      <View style={styles.container}>
        <View style={styles.customerHeader}>
          <Text style={styles.customerName}>{customerData.name}</Text>
          {customerData.phone && (
            <Text style={styles.customerContact}>📱 {customerData.phone}</Text>
          )}
          
          <View style={[
            styles.balanceCard,
            customerData.balance > 0 ? styles.balanceOwe : 
            customerData.balance < 0 ? styles.balanceReceive : styles.balanceNeutral
          ]}>
            <Text style={styles.balanceTitle}>
              {customerData.balance > 0 ? 'You Owe Customer' : 
               customerData.balance < 0 ? 'Customer Owes You' : 'Balance Settled'}
            </Text>
            <Text style={styles.balanceAmount}>
              {formatCurrency(Math.abs(customerData.balance))}
            </Text>
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
            <TouchableOpacity 
              key={item.id} 
              style={styles.transactionCard}
              onPress={() => editTransaction(item)}
            >
              <View style={styles.transactionHeaderRow}>
                <View style={styles.transactionTypeBadge}>
                  <Text style={styles.transactionTypeText}>
                    {item.type === 'order' ? '📦 ORDER' : '💵 PAYMENT'}
                  </Text>
                  <Text style={styles.transactionIndex}>#{index + 1}</Text>
                </View>
                <View style={styles.transactionActions}>
                  <TouchableOpacity 
                    style={styles.smallEditButton}
                    onPress={() => editTransaction(item)}
                  >
                    <Icon name="edit" size={16} color="#007AFF" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.smallDeleteButton}
                    onPress={() => deleteTransaction(
                      item.id, 
                      item.type, 
                      item.type === 'order' ? item.billBDT : item.amount
                    )}
                  >
                    <Icon name="delete" size={16} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              </View>
              
              <Text style={styles.transactionDate}>
                📅 {item.date} • 🕒 {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </Text>
              
              {item.type === 'order' ? (
                <View style={styles.transactionDetails}>
                  <View style={styles.transactionRow}>
                    <Text style={styles.transactionLabel}>RMB Amount:</Text>
                    <Text style={styles.transactionValue}>{item.rmbAmount}</Text>
                  </View>
                  {item.supplierName && (
                    <View style={styles.transactionRow}>
                      <Text style={styles.transactionLabel}>Supplier:</Text>
                      <Text style={styles.transactionValue}>{item.supplierName}</Text>
                    </View>
                  )}
                  <View style={styles.transactionRow}>
                    <Text style={styles.transactionLabel}>Rate:</Text>
                    <Text style={styles.transactionValue}>{item.supplierRate} BDT/RMB</Text>
                  </View>
                  <View style={styles.transactionRow}>
                    <Text style={styles.transactionLabel}>Bill Amount:</Text>
                    <Text style={[styles.transactionValue, styles.boldText]}>
                      {formatCurrency(item.billBDT)}
                    </Text>
                  </View>
                  {item.notes && (
                    <View style={styles.notesContainer}>
                      <Text style={styles.notesLabel}>Note:</Text>
                      <Text style={styles.notesText}>{item.notes}</Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.transactionDetails}>
                  <View style={styles.transactionRow}>
                    <Text style={styles.transactionLabel}>Payment Amount:</Text>
                    <Text style={[styles.transactionValue, styles.boldText]}>
                      {formatCurrency(item.amount)}
                    </Text>
                  </View>
                  {item.notes && (
                    <View style={styles.notesContainer}>
                      <Text style={styles.notesLabel}>Note:</Text>
                      <Text style={styles.notesText}>{item.notes}</Text>
                    </View>
                  )}
                </View>
              )}
              
              <Text style={styles.transactionTime}>
                {item.createdAt ? `Added: ${item.createdAt}` : ''}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyTransactionState}>
              <Icon name="receipt" size={64} color="#ccc" />
              <Text style={styles.emptyTransactionText}>No transactions yet</Text>
              <Text style={styles.emptyTransactionSubtext}>Add your first order or payment</Text>
            </View>
          }
        />
  
        {/* New Order Modal with Supplier Selection */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={orderModalVisible}
          onRequestClose={() => setOrderModalVisible(false)}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>📦 New Order</Text>
              
              <TextInput
                style={styles.input}
                placeholder="RMB Amount"
                value={newOrder.rmbAmount}
                onChangeText={(text) => setNewOrder({...newOrder, rmbAmount: text})}
                keyboardType="numeric"
              />
              
              {/* Supplier Selection */}
              <View style={styles.dropdownContainer}>
                <Text style={styles.dropdownLabel}>Select Supplier:</Text>
                <ScrollView style={styles.supplierList} nestedScrollEnabled={true}>
                  {suppliers.map(supplier => (
                    <TouchableOpacity
                      key={supplier.id}
                      style={[
                        styles.supplierOption,
                        newOrder.supplierId === supplier.id && styles.supplierOptionSelected
                      ]}
                      onPress={() => handleSupplierSelect(supplier.id)}
                    >
                      <Icon 
                        name="business" 
                        size={18} 
                        color={newOrder.supplierId === supplier.id ? 'white' : '#666'} 
                      />
                      <Text style={[
                        styles.supplierOptionText,
                        newOrder.supplierId === supplier.id && styles.supplierOptionTextSelected
                      ]}>
                        {supplier.name}
                      </Text>
                      {newOrder.supplierId === supplier.id && (
                        <Icon name="check" size={18} color="white" />
                      )}
                    </TouchableOpacity>
                  ))}
                  {suppliers.length === 0 && (
                    <Text style={styles.noSuppliersText}>No suppliers available. Add suppliers first.</Text>
                  )}
                </ScrollView>
              </View>
              
              {newOrder.supplierId && (
                <TextInput
                  style={styles.input}
                  placeholder={`Supplier Rate (BDT per RMB)`}
                  value={newOrder.supplierRate}
                  onChangeText={(text) => setNewOrder({...newOrder, supplierRate: text})}
                  keyboardType="numeric"
                />
              )}
              
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Notes (Optional)"
                value={newOrder.notes}
                onChangeText={(text) => setNewOrder({...newOrder, notes: text})}
                multiline
                numberOfLines={2}
              />
              
              {newOrder.rmbAmount && newOrder.supplierRate && (
                <View style={styles.calculationBox}>
                  <Text style={styles.calculationText}>
                    Bill Amount: {formatCurrency((parseFloat(newOrder.rmbAmount) || 0) * (parseFloat(newOrder.supplierRate) || 0))}
                  </Text>
                  {newOrder.supplierName && (
                    <Text style={styles.calculationSupplier}>
                      Supplier: {newOrder.supplierName}
                    </Text>
                  )}
                </View>
              )}
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setOrderModalVisible(false)}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleNewOrder}
                  disabled={!newOrder.rmbAmount || !newOrder.supplierId || !newOrder.supplierRate}
                >
                  <Text style={styles.modalButtonText}>Save Order</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
        
  
        {/* Payment Modal */}
        <Modal
          animationType="slide"
          transparent={true}
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
                onChangeText={(text) => setNewPayment({...newPayment, amount: text})}
                keyboardType="numeric"
              />
              
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Notes (Optional)"
                value={newPayment.notes}
                onChangeText={(text) => setNewPayment({...newPayment, notes: text})}
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
  
        {/* Edit Transaction Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={editModalVisible}
          onRequestClose={() => setEditModalVisible(false)}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                ✏️ Edit {editingTransaction.type === 'order' ? 'Order' : 'Payment'}
              </Text>
              
              {editingTransaction.type === 'order' ? (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="RMB Amount"
                    value={editingTransaction.rmbAmount}
                    onChangeText={(text) => setEditingTransaction({...editingTransaction, rmbAmount: text})}
                    keyboardType="numeric"
                  />
                  
                  {/* Supplier Selection in Edit */}
                  <View style={styles.dropdownContainer}>
                    <Text style={styles.dropdownLabel}>Supplier:</Text>
                    <ScrollView style={styles.supplierList} nestedScrollEnabled={true}>
                      {suppliers.map(supplier => (
                        <TouchableOpacity
                          key={supplier.id}
                          style={[
                            styles.supplierOption,
                            editingTransaction.supplierId === supplier.id && styles.supplierOptionSelected
                          ]}
                          onPress={() => {
                            setEditingTransaction({
                              ...editingTransaction,
                              supplierId: supplier.id,
                              supplierName: supplier.name
                            });
                          }}
                        >
                          <Icon 
                            name="business" 
                            size={18} 
                            color={editingTransaction.supplierId === supplier.id ? 'white' : '#666'} 
                          />
                          <Text style={[
                            styles.supplierOptionText,
                            editingTransaction.supplierId === supplier.id && styles.supplierOptionTextSelected
                          ]}>
                            {supplier.name}
                          </Text>
                          {editingTransaction.supplierId === supplier.id && (
                            <Icon name="check" size={18} color="white" />
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                  
                  <TextInput
                    style={styles.input}
                    placeholder="Supplier Rate (BDT per RMB)"
                    value={editingTransaction.supplierRate}
                    onChangeText={(text) => setEditingTransaction({...editingTransaction, supplierRate: text})}
                    keyboardType="numeric"
                  />
                  
                  {editingTransaction.rmbAmount && editingTransaction.supplierRate && (
                    <View style={styles.calculationBox}>
                      <Text style={styles.calculationText}>
                        Bill: {formatCurrency((parseFloat(editingTransaction.rmbAmount) || 0) * (parseFloat(editingTransaction.supplierRate) || 0))}
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Amount (BDT)"
                    value={editingTransaction.amount}
                    onChangeText={(text) => setEditingTransaction({...editingTransaction, amount: text})}
                    keyboardType="numeric"
                  />
                </>
              )}
              
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Notes (Optional)"
                value={editingTransaction.notes}
                onChangeText={(text) => setEditingTransaction({...editingTransaction, notes: text})}
                multiline
                numberOfLines={3}
              />
              
              <TextInput
                style={styles.input}
                placeholder="Date (YYYY-MM-DD)"
                value={editingTransaction.date}
                onChangeText={(text) => setEditingTransaction({...editingTransaction, date: text})}
              />
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setEditModalVisible(false)}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleUpdateTransaction}
                >
                  <Text style={styles.modalButtonText}>Update</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    );
}
