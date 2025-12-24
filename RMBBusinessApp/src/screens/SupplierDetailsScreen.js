import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    TextInput,
    FlatList,
    ScrollView,
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
    onSnapshot,
  } from 'firebase/firestore';

import { db } from '../config/firebase';
import styles from '../styles/styles';

import { formatUSD } from '../utils/format';
import { getTodayDate } from '../utils/date';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function SupplierDetailsScreen({ route }) {
        const { supplier } = route.params;
        const [supplierData, setSupplierData] = useState(supplier);
        const [transactions, setTransactions] = useState([]);
        const [billModalVisible, setBillModalVisible] = useState(false);
        const [paymentModalVisible, setPaymentModalVisible] = useState(false);
        const [editModalVisible, setEditModalVisible] = useState(false);
        
        const [newRMBBill, setNewRMBBill] = useState({
          rmbAmount: '',
          rate: '', // Supplier rate: RMB per $
          description: '',
          date: getTodayDate(),
        });
        
        const [newUSDTBill, setNewUSDTBill] = useState({
          bdtAmount: '',
          rate: '', // BDT per $
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
        }, []);
      
        const loadTransactions = async () => {
          try {
            // Try to load from Firestore first
            const transactionsRef = collection(db, `suppliers/${supplier.id}/transactions`);
            const querySnapshot = await getDocs(transactionsRef);
            const transactionsList = [];
            querySnapshot.forEach((doc) => {
              transactionsList.push({ id: doc.id, ...doc.data() });
            });
            // Sort by date descending (newest first)
            transactionsList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            setTransactions(transactionsList);
            // Also save to AsyncStorage for backup
            await AsyncStorage.setItem(`supplier_transactions_${supplier.id}`, JSON.stringify(transactionsList));
          } catch (error) {
            console.error('Error loading transactions from Firestore:', error);
            // Fallback to AsyncStorage
            const storedTransactions = await AsyncStorage.getItem(`supplier_transactions_${supplier.id}`);
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
      
        const saveTransaction = async (type, data, isEdit = false) => {
          try {
            const newTransaction = {
              supplierId: supplier.id,
              supplierName: supplier.name,
              supplierType: supplier.type,
              type: type, // 'bill' or 'payment'
              ...data,
              date: data.date || getTodayDate(),
              timestamp: isEdit ? (editingTransaction.timestamp || new Date().toISOString()) : new Date().toISOString(),
            };
      
            // Remove undefined values
            Object.keys(newTransaction).forEach(key => {
              if (newTransaction[key] === undefined) {
                delete newTransaction[key];
              }
            });
      
            let balanceChange = 0;
            if (type === 'bill') {
              balanceChange = data.amountUSD || 0; // Bills INCREASE what you owe
            } else if (type === 'payment') {
              balanceChange = -(data.amountUSD || 0); // Payments DECREASE what you owe
            }
      
            const currentBalanceUSD = parseFloat(supplierData.balanceUSD) || 0;
            const newBalanceUSD = currentBalanceUSD + balanceChange;
      
            if (isEdit && editingTransaction.id) {
              // For edits, we need to reverse the old transaction first
              const oldTransaction = transactions.find(t => t.id === editingTransaction.id);
              let oldBalanceChange = 0;
              
              if (oldTransaction.type === 'bill') {
                oldBalanceChange = -(oldTransaction.amountUSD || 0); // Reverse old bill
              } else if (oldTransaction.type === 'payment') {
                oldBalanceChange = oldTransaction.amountUSD || 0; // Reverse old payment
              }
              
              // Calculate with reversed old transaction
              const balanceAfterReverse = currentBalanceUSD + oldBalanceChange;
              const finalBalance = balanceAfterReverse + balanceChange;
              
              // Update in Firestore - Remove undefined fields
              const updateData = { ...newTransaction };
              delete updateData.id; // Don't update the ID field
              delete updateData.createdAt; // Remove createdAt for updates
              
              await updateDoc(doc(db, `suppliers/${supplier.id}/transactions`, editingTransaction.id), updateData);
              
              // Update local state - NEWEST FIRST
              const updatedTransactions = transactions.map(t => 
                t.id === editingTransaction.id ? { ...t, ...newTransaction } : t
              );
              updatedTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
              setTransactions(updatedTransactions);
              
              // Also save to AsyncStorage
              await AsyncStorage.setItem(`supplier_transactions_${supplier.id}`, JSON.stringify(updatedTransactions));
              
              // Update supplier balance
              const updatedSupplier = { ...supplierData, balanceUSD: finalBalance };
              setSupplierData(updatedSupplier);
              
              // Update in Firestore suppliers collection
              await updateDoc(doc(db, 'suppliers', supplier.id), { 
                balanceUSD: finalBalance, 
                updatedAt: getTodayDate() 
              });
              
              // Update in AsyncStorage suppliers list
              const storedSuppliers = await AsyncStorage.getItem('suppliers');
              if (storedSuppliers) {
                const suppliersList = JSON.parse(storedSuppliers);
                const updatedSuppliers = suppliersList.map(s => 
                  s.id === supplier.id ? updatedSupplier : s
                );
                await AsyncStorage.setItem('suppliers', JSON.stringify(updatedSuppliers));
              }
            } else {
              // For new transactions - Add createdAt for new records
              newTransaction.createdAt = getTodayDate();
              
              // Save to Firestore
              const docRef = await addDoc(collection(db, `suppliers/${supplier.id}/transactions`), newTransaction);
              const transactionWithId = { id: docRef.id, ...newTransaction };
              
              // Add at beginning and sort by timestamp (newest first)
              const updatedTransactions = [transactionWithId, ...transactions];
              updatedTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
              setTransactions(updatedTransactions);
              
              // Also save to AsyncStorage
              await AsyncStorage.setItem(`supplier_transactions_${supplier.id}`, JSON.stringify(updatedTransactions));
      
              // Update supplier balance
              const updatedSupplier = { ...supplierData, balanceUSD: newBalanceUSD };
              setSupplierData(updatedSupplier);
      
              // Update in Firestore suppliers collection
              await updateDoc(doc(db, 'suppliers', supplier.id), { 
                balanceUSD: newBalanceUSD, 
                updatedAt: getTodayDate() 
              });
              
              // Update in AsyncStorage suppliers list
              const storedSuppliers = await AsyncStorage.getItem('suppliers');
              if (storedSuppliers) {
                const suppliersList = JSON.parse(storedSuppliers);
                const updatedSuppliers = suppliersList.map(s => 
                  s.id === supplier.id ? updatedSupplier : s
                );
                await AsyncStorage.setItem('suppliers', JSON.stringify(updatedSuppliers));
              }
            }
      
            Alert.alert('Success', `${isEdit ? 'Transaction updated' : 'Transaction saved'} to cloud!`);
            
            // Reset forms
            if (type === 'bill') {
              setBillModalVisible(false);
              if (supplier.type === 'RMB') {
                setNewRMBBill({ rmbAmount: '', rate: '', description: '', date: getTodayDate() });
              } else {
                setNewUSDTBill({ bdtAmount: '', rate: '', description: '', date: getTodayDate() });
              }
            } else if (type === 'payment') {
              setPaymentModalVisible(false);
              setNewPayment({ amountUSD: '', description: '', date: getTodayDate() });
            }
            if (isEdit) {
              setEditModalVisible(false);
              setEditingTransaction({ 
                id: '', type: '', supplierType: '', rmbAmount: '', bdtAmount: '', 
                rate: '', amountUSD: '', description: '', calculation: '', date: getTodayDate() 
              });
            }
          } catch (error) {
            console.error('Error saving transaction:', error);
            Alert.alert('Error', `Failed to save: ${error.message}`);
            // Fallback to AsyncStorage only
            handleLocalSave(type, data, isEdit);
          }
        };
      
        const handleLocalSave = async (type, data, isEdit = false) => {
          const newTransaction = {
            id: isEdit ? editingTransaction.id : Date.now().toString(),
            supplierId: supplier.id,
            supplierName: supplier.name,
            supplierType: supplier.type,
            type: type, // 'bill' or 'payment'
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
          await AsyncStorage.setItem(`supplier_transactions_${supplier.id}`, JSON.stringify(updatedTransactions));
      
          // Update supplier balance locally
          let balanceChange = 0;
          if (type === 'bill') {
            balanceChange = data.amountUSD || 0;
          } else if (type === 'payment') {
            balanceChange = -(data.amountUSD || 0);
          }
      
          const currentBalance = parseFloat(supplierData.balanceUSD) || 0;
          const newBalance = currentBalance + balanceChange;
          const updatedSupplier = { ...supplierData, balanceUSD: newBalance };
          setSupplierData(updatedSupplier);
      
          // Update in main suppliers list locally
          const storedSuppliers = await AsyncStorage.getItem('suppliers');
          if (storedSuppliers) {
            const suppliers = JSON.parse(storedSuppliers);
            const updatedSuppliers = suppliers.map(s => 
              s.id === supplier.id ? updatedSupplier : s
            );
            await AsyncStorage.setItem('suppliers', JSON.stringify(updatedSuppliers));
          }
      
          Alert.alert('Saved locally', `${isEdit ? 'Transaction updated' : 'Transaction saved'} to device`);
          
          // Reset forms
          if (type === 'bill') {
            setBillModalVisible(false);
            if (supplier.type === 'RMB') {
              setNewRMBBill({ rmbAmount: '', rate: '', description: '', date: getTodayDate() });
            } else {
              setNewUSDTBill({ bdtAmount: '', rate: '', description: '', date: getTodayDate() });
            }
          } else if (type === 'payment') {
            setPaymentModalVisible(false);
            setNewPayment({ amountUSD: '', description: '', date: getTodayDate() });
          }
          if (isEdit) {
            setEditModalVisible(false);
            setEditingTransaction({ 
              id: '', type: '', supplierType: '', rmbAmount: '', bdtAmount: '', 
              rate: '', amountUSD: '', description: '', calculation: '', date: getTodayDate() 
            });
          }
        };
      
        const handleNewBill = () => {
          if (supplierData.type === 'RMB') {
            // RMB Supplier calculation
            if (!newRMBBill.rmbAmount || !newRMBBill.rate) {
              Alert.alert('Error', 'Please enter RMB amount and rate');
              return;
            }
            
            const rmbAmount = parseFloat(newRMBBill.rmbAmount) || 0;
            const rate = parseFloat(newRMBBill.rate) || 0;
            const amountUSD = rate > 0 ? rmbAmount / rate : 0;
            
            saveTransaction('bill', {
              ...newRMBBill,
              rmbAmount: rmbAmount,
              rate: rate,
              amountUSD: amountUSD,
              calculation: `${rmbAmount} RMB / ${rate} = ${amountUSD.toFixed(2)} USD`,
            });
          } else {
            // USDT Supplier calculation (BDT to $)
            if (!newUSDTBill.bdtAmount || !newUSDTBill.rate) {
              Alert.alert('Error', 'Please enter BDT amount and rate');
              return;
            }
            
            const bdtAmount = parseFloat(newUSDTBill.bdtAmount) || 0;
            const rate = parseFloat(newUSDTBill.rate) || 0;
            const amountUSD = rate > 0 ? bdtAmount / rate : 0;
            
            saveTransaction('bill', {
              ...newUSDTBill,
              bdtAmount: bdtAmount,
              rate: rate,
              amountUSD: amountUSD,
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
            amountUSD: parseFloat(newPayment.amountUSD),
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
              
              saveTransaction('bill', {
                rmbAmount: rmbAmount,
                rate: rate,
                amountUSD: amountUSD,
                calculation: `${rmbAmount} RMB / ${rate} = ${amountUSD.toFixed(2)} USD`,
                description: editingTransaction.description,
                date: editingTransaction.date,
              }, true);
            } else {
              if (!editingTransaction.bdtAmount || !editingTransaction.rate) {
                Alert.alert('Error', 'Please enter BDT amount and rate');
                return;
              }
              
              const bdtAmount = parseFloat(editingTransaction.bdtAmount) || 0;
              const rate = parseFloat(editingTransaction.rate) || 0;
              const amountUSD = rate > 0 ? bdtAmount / rate : 0;
              
              saveTransaction('bill', {
                bdtAmount: bdtAmount,
                rate: rate,
                amountUSD: amountUSD,
                calculation: `${bdtAmount} BDT / ${rate} = ${amountUSD.toFixed(2)} USD`,
                description: editingTransaction.description,
                date: editingTransaction.date,
              }, true);
            }
          } else if (editingTransaction.type === 'payment') {
            if (!editingTransaction.amountUSD) {
              Alert.alert('Error', 'Please enter payment amount in USD');
              return;
            }
            
            saveTransaction('payment', {
              amountUSD: parseFloat(editingTransaction.amountUSD),
              description: editingTransaction.description,
              date: editingTransaction.date,
            }, true);
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
                    const transactionToDelete = transactions.find(t => t.id === transactionId);
                    if (!transactionToDelete) return;
                    
                    // Calculate balance change (reverse the transaction)
                    let balanceChange = 0;
                    if (transactionToDelete.type === 'bill') {
                      balanceChange = -(transactionToDelete.amountUSD || 0); // Reverse bill
                    } else if (transactionToDelete.type === 'payment') {
                      balanceChange = transactionToDelete.amountUSD || 0; // Reverse payment
                    }
                    
                    const currentBalance = parseFloat(supplierData.balanceUSD) || 0;
                    const newBalance = currentBalance + balanceChange;
                    
                    // Delete from Firestore
                    await deleteDoc(doc(db, `suppliers/${supplier.id}/transactions`, transactionId));
                    
                    const updatedTransactions = transactions.filter(t => t.id !== transactionId);
                    updatedTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                    setTransactions(updatedTransactions);
                    await AsyncStorage.setItem(`supplier_transactions_${supplier.id}`, JSON.stringify(updatedTransactions));
                    
                    // Update supplier balance
                    const updatedSupplier = { ...supplierData, balanceUSD: newBalance };
                    setSupplierData(updatedSupplier);
                    
                    // Update in Firestore
                    await updateDoc(doc(db, 'suppliers', supplier.id), { 
                      balanceUSD: newBalance,
                      updatedAt: getTodayDate()
                    });
                    
                    // Update in AsyncStorage
                    const storedSuppliers = await AsyncStorage.getItem('suppliers');
                    if (storedSuppliers) {
                      const suppliers = JSON.parse(storedSuppliers);
                      const updatedSuppliers = suppliers.map(s => 
                        s.id === supplier.id ? updatedSupplier : s
                      );
                      await AsyncStorage.setItem('suppliers', JSON.stringify(updatedSuppliers));
                    }
                    
                    Alert.alert('Success', 'Transaction deleted from cloud!');
                  } catch (error) {
                    console.error('Error deleting transaction:', error);
                    // Fallback to AsyncStorage
                    const transactionToDelete = transactions.find(t => t.id === transactionId);
                    if (!transactionToDelete) return;
                    
                    let balanceChange = 0;
                    if (transactionToDelete.type === 'bill') {
                      balanceChange = -(transactionToDelete.amountUSD || 0);
                    } else if (transactionToDelete.type === 'payment') {
                      balanceChange = transactionToDelete.amountUSD || 0;
                    }
                    
                    const currentBalance = parseFloat(supplierData.balanceUSD) || 0;
                    const newBalance = currentBalance + balanceChange;
                    
                    const updatedTransactions = transactions.filter(t => t.id !== transactionId);
                    updatedTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                    setTransactions(updatedTransactions);
                    await AsyncStorage.setItem(`supplier_transactions_${supplier.id}`, JSON.stringify(updatedTransactions));
                    
                    const updatedSupplier = { ...supplierData, balanceUSD: newBalance };
                    setSupplierData(updatedSupplier);
                    
                    // Update in main suppliers list locally
                    const storedSuppliers = await AsyncStorage.getItem('suppliers');
                    if (storedSuppliers) {
                      const suppliers = JSON.parse(storedSuppliers);
                      const updatedSuppliers = suppliers.map(s => 
                        s.id === supplier.id ? updatedSupplier : s
                      );
                      await AsyncStorage.setItem('suppliers', JSON.stringify(updatedSuppliers));
                    }
                    
                    Alert.alert('Deleted locally', 'Transaction deleted from device');
                  }
                },
              },
            ]
          );
        };
      
        return (
          <View style={styles.container}>
            <View style={styles.supplierHeader}>
              <Text style={styles.supplierName}>{supplierData.name}</Text>
              <Text style={[
                styles.supplierType,
                supplierData.type === 'RMB' ? styles.rmbType : styles.usdtType
              ]}>
                {supplierData.type} Supplier
              </Text>
              
              {supplierData.contact && (
                <Text style={styles.supplierContact}>📞 {supplierData.contact}</Text>
              )}
              
              <View style={[
                styles.balanceCard,
                supplierData.balanceUSD > 0 ? styles.balanceOwe : 
                supplierData.balanceUSD < 0 ? styles.balanceReceive : styles.balanceNeutral
              ]}>
                <Text style={styles.balanceTitle}>
                  {supplierData.balanceUSD > 0 ? 'You Owe Supplier' : 
                   supplierData.balanceUSD < 0 ? 'Supplier Owes You' : 'Balance Settled'}
                </Text>
                <Text style={styles.balanceAmount}>
                  {formatUSD(Math.abs(supplierData.balanceUSD))}
                </Text>
                <Text style={styles.transactionCount}>
                  {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
      
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={[styles.actionButtonLarge, styles.billButton]}
                onPress={() => setBillModalVisible(true)}
              >
                <Icon name="receipt" size={24} color="white" />
                <Text style={styles.actionButtonText}>
                  New {supplierData.type === 'RMB' ? 'RMB' : 'USDT'} Bill
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.actionButtonLarge, styles.paymentButton]}
                onPress={() => setPaymentModalVisible(true)}
              >
                <Icon name="attach-money" size={24} color="white" />
                <Text style={styles.actionButtonText}>Make Payment</Text>
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
                        {item.type === 'bill' ? '📦 BILL' : '💵 PAYMENT'}
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
                        onPress={() => deleteTransaction(item.id)}
                      >
                        <Icon name="delete" size={16} color="#FF3B30" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  <Text style={styles.transactionDate}>
                    📅 {item.date} • 🕒 {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </Text>
                  
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
                        <Text style={[styles.transactionValue, styles.boldText]}>
                          {formatUSD(item.amountUSD)}
                        </Text>
                      </View>
                      {item.calculation && (
                        <View style={styles.notesContainer}>
                          <Text style={styles.notesLabel}>Calculation:</Text>
                          <Text style={styles.notesText}>{item.calculation}</Text>
                        </View>
                      )}
                      {item.description && (
                        <View style={styles.notesContainer}>
                          <Text style={styles.notesLabel}>Note:</Text>
                          <Text style={styles.notesText}>{item.description}</Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={styles.transactionDetails}>
                      <View style={styles.transactionRow}>
                        <Text style={styles.transactionLabel}>Payment Amount:</Text>
                        <Text style={[styles.transactionValue, styles.boldText]}>
                          {formatUSD(item.amountUSD)}
                        </Text>
                      </View>
                      {item.description && (
                        <View style={styles.notesContainer}>
                          <Text style={styles.notesLabel}>Note:</Text>
                          <Text style={styles.notesText}>{item.description}</Text>
                        </View>
                      )}
                    </View>
                  )}
                  
                  <Text style={styles.transactionTime}>
                    {item.createdAt ? `Added: ${item.createdAt}` : ''}
                  </Text>
                </TouchableOpacity>
              )}
            />
      
            {/* New Bill Modal */}
            <Modal
              animationType="slide"
              transparent={true}
              visible={billModalVisible}
              onRequestClose={() => setBillModalVisible(false)}
            >
              <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.modalOverlay}
              >
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>
                    📋 New {supplierData.type === 'RMB' ? 'RMB' : 'USDT'} Bill
                  </Text>
                  
                  {supplierData.type === 'RMB' ? (
                    <>
                      <TextInput
                        style={styles.input}
                        placeholder="RMB Amount"
                        value={newRMBBill.rmbAmount}
                        onChangeText={(text) => setNewRMBBill({...newRMBBill, rmbAmount: text})}
                        keyboardType="numeric"
                      />
                      
                      <TextInput
                        style={styles.input}
                        placeholder="Supplier Rate (RMB per $)"
                        value={newRMBBill.rate}
                        onChangeText={(text) => setNewRMBBill({...newRMBBill, rate: text})}
                        keyboardType="numeric"
                      />
                      
                      {newRMBBill.rmbAmount && newRMBBill.rate && (
                        <View style={styles.calculationBox}>
                          <Text style={styles.calculationText}>
                            Bill Amount: ${((parseFloat(newRMBBill.rmbAmount) || 0) / (parseFloat(newRMBBill.rate) || 1)).toFixed(2)}
                          </Text>
                          <Text style={styles.calculationFormula}>
                            {newRMBBill.rmbAmount} RMB ÷ {newRMBBill.rate} = ${((parseFloat(newRMBBill.rmbAmount) || 0) / (parseFloat(newRMBBill.rate) || 1)).toFixed(2)} USD
                          </Text>
                        </View>
                      )}
                    </>
                  ) : (
                    <>
                      <TextInput
                        style={styles.input}
                        placeholder="BDT Amount"
                        value={newUSDTBill.bdtAmount}
                        onChangeText={(text) => setNewUSDTBill({...newUSDTBill, bdtAmount: text})}
                        keyboardType="numeric"
                      />
                      
                      <TextInput
                        style={styles.input}
                        placeholder="Supplier Rate (BDT per $)"
                        value={newUSDTBill.rate}
                        onChangeText={(text) => setNewUSDTBill({...newUSDTBill, rate: text})}
                        keyboardType="numeric"
                      />
                      
                      {newUSDTBill.bdtAmount && newUSDTBill.rate && (
                        <View style={styles.calculationBox}>
                          <Text style={styles.calculationText}>
                            Bill Amount: ${((parseFloat(newUSDTBill.bdtAmount) || 0) / (parseFloat(newUSDTBill.rate) || 1)).toFixed(2)}
                          </Text>
                          <Text style={styles.calculationFormula}>
                            {newUSDTBill.bdtAmount} BDT ÷ {newUSDTBill.rate} = ${((parseFloat(newUSDTBill.bdtAmount) || 0) / (parseFloat(newUSDTBill.rate) || 1)).toFixed(2)} USD
                          </Text>
                        </View>
                      )}
                    </>
                  )}
                  
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Description (Optional)"
                    value={supplierData.type === 'RMB' ? newRMBBill.description : newUSDTBill.description}
                    onChangeText={(text) => {
                      if (supplierData.type === 'RMB') {
                        setNewRMBBill({...newRMBBill, description: text});
                      } else {
                        setNewUSDTBill({...newUSDTBill, description: text});
                      }
                    }}
                    multiline
                    numberOfLines={3}
                  />
                  
                  <View style={styles.modalButtons}>
                    <TouchableOpacity 
                      style={[styles.modalButton, styles.cancelButton]}
                      onPress={() => setBillModalVisible(false)}
                    >
                      <Text style={styles.modalButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[styles.modalButton, styles.saveButton]}
                      onPress={handleNewBill}
                    >
                      <Text style={styles.modalButtonText}>Save Bill</Text>
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
                  <Text style={styles.modalTitle}>💵 Make Payment to Supplier</Text>
                  
                  <TextInput
                    style={styles.input}
                    placeholder="Amount in USD"
                    value={newPayment.amountUSD}
                    onChangeText={(text) => setNewPayment({...newPayment, amountUSD: text})}
                    keyboardType="numeric"
                  />
                  
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Description (Optional)"
                    value={newPayment.description}
                    onChangeText={(text) => setNewPayment({...newPayment, description: text})}
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
                    ✏️ Edit {editingTransaction.type === 'bill' ? 'Bill' : 'Payment'}
                  </Text>
                  
                  {editingTransaction.type === 'bill' ? (
                    editingTransaction.supplierType === 'RMB' ? (
                      <>
                        <TextInput
                          style={styles.input}
                          placeholder="RMB Amount"
                          value={editingTransaction.rmbAmount}
                          onChangeText={(text) => setEditingTransaction({...editingTransaction, rmbAmount: text})}
                          keyboardType="numeric"
                        />
                        
                        <TextInput
                          style={styles.input}
                          placeholder="Supplier Rate (RMB per $)"
                          value={editingTransaction.rate}
                          onChangeText={(text) => setEditingTransaction({...editingTransaction, rate: text})}
                          keyboardType="numeric"
                        />
                        
                        {editingTransaction.rmbAmount && editingTransaction.rate && (
                          <View style={styles.calculationBox}>
                            <Text style={styles.calculationText}>
                              Bill Amount: ${((parseFloat(editingTransaction.rmbAmount) || 0) / (parseFloat(editingTransaction.rate) || 1)).toFixed(2)}
                            </Text>
                            <Text style={styles.calculationFormula}>
                              {editingTransaction.rmbAmount} RMB ÷ {editingTransaction.rate} = ${((parseFloat(editingTransaction.rmbAmount) || 0) / (parseFloat(editingTransaction.rate) || 1)).toFixed(2)} USD
                            </Text>
                          </View>
                        )}
                      </>
                    ) : (
                      <>
                        <TextInput
                          style={styles.input}
                          placeholder="BDT Amount"
                          value={editingTransaction.bdtAmount}
                          onChangeText={(text) => setEditingTransaction({...editingTransaction, bdtAmount: text})}
                          keyboardType="numeric"
                        />
                        
                        <TextInput
                          style={styles.input}
                          placeholder="Supplier Rate (BDT per $)"
                          value={editingTransaction.rate}
                          onChangeText={(text) => setEditingTransaction({...editingTransaction, rate: text})}
                          keyboardType="numeric"
                        />
                        
                        {editingTransaction.bdtAmount && editingTransaction.rate && (
                          <View style={styles.calculationBox}>
                            <Text style={styles.calculationText}>
                              Bill Amount: ${((parseFloat(editingTransaction.bdtAmount) || 0) / (parseFloat(editingTransaction.rate) || 1)).toFixed(2)}
                            </Text>
                            <Text style={styles.calculationFormula}>
                              {editingTransaction.bdtAmount} BDT ÷ {editingTransaction.rate} = ${((parseFloat(editingTransaction.bdtAmount) || 0) / (parseFloat(editingTransaction.rate) || 1)).toFixed(2)} USD
                            </Text>
                          </View>
                        )}
                      </>
                    )
                  ) : (
                    <>
                      <TextInput
                        style={styles.input}
                        placeholder="Amount in USD"
                        value={editingTransaction.amountUSD}
                        onChangeText={(text) => setEditingTransaction({...editingTransaction, amountUSD: text})}
                        keyboardType="numeric"
                      />
                    </>
                  )}
                  
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Description (Optional)"
                    value={editingTransaction.description}
                    onChangeText={(text) => setEditingTransaction({...editingTransaction, description: text})}
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
