import React, { useEffect, useState, useCallback } from 'react';
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
    ScrollView
  } from 'react-native';
  import Icon from 'react-native-vector-icons/MaterialIcons';  

import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, getDocs } from 'firebase/firestore';

import { db } from '../config/firebase';
import styles from '../styles/styles';
import { getTodayDate } from '../utils/date';


import { formatCurrency, formatUSD } from '../utils/format';

export default function BankWalletDetailsScreen({ route }) {
    const { item, type } = route.params;
    const [itemData, setItemData] = useState(item);
    const [transactions, setTransactions] = useState([]);
    const [actionModalVisible, setActionModalVisible] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    
    const [newAction, setNewAction] = useState({
      type: 'deposit',
      amount: '',
      description: '',
      date: getTodayDate(),
    });
    
    const [editData, setEditData] = useState({
      name: item.name,
      account: item.account || '',
      address: item.address || '',
    });
  
    useEffect(() => {
      loadTransactions();
    }, []);
  
    const loadTransactions = async () => {
      try {
        // Try to load from Firestore first
        const transactionsRef = collection(db, `${type}s/${item.id}/transactions`);
        const querySnapshot = await getDocs(transactionsRef);
        const transactionsList = [];
        querySnapshot.forEach((doc) => {
          transactionsList.push({ id: doc.id, ...doc.data() });
        });
        // Sort by timestamp descending (newest first)
        transactionsList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setTransactions(transactionsList);
        // Also save to AsyncStorage for backup
        await AsyncStorage.setItem(`${type}_transactions_${item.id}`, JSON.stringify(transactionsList));
      } catch (error) {
        console.error(`Error loading ${type} transactions from Firestore:`, error);
        // Fallback to AsyncStorage
        loadTransactionsFromStorage();
      }
    };
  
    const loadTransactionsFromStorage = async () => {
      try {
        const storedTransactions = await AsyncStorage.getItem(`${type}_transactions_${item.id}`);
        if (storedTransactions) {
          const transactionsList = JSON.parse(storedTransactions);
          transactionsList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          setTransactions(transactionsList);
        }
      } catch (error) {
        console.error(`Error loading ${type} transactions from storage:`, error);
      }
    };
  
    const onRefresh = async () => {
      setRefreshing(true);
      await loadTransactions();
      setRefreshing(false);
    };
  
    const saveAction = async () => {
      if (!newAction.amount) {
        Alert.alert('Error', 'Please enter amount');
        return;
      }
  
      const amount = parseFloat(newAction.amount) || 0;
      if (amount <= 0) {
        Alert.alert('Error', 'Amount must be greater than 0');
        return;
      }
  
      try {
        const currentBalance = type === 'bank' 
          ? parseFloat(itemData.balance) || 0
          : parseFloat(itemData.balanceUSD) || 0;
        
        const newBalance = newAction.type === 'deposit' 
          ? currentBalance + amount
          : currentBalance - amount;
  
        // Check if withdrawal is possible
        if (newAction.type === 'withdraw' && newBalance < 0) {
          Alert.alert('Error', 'Insufficient balance for withdrawal');
          return;
        }
  
        // Update UI immediately
        const updatedItem = { ...itemData };
        if (type === 'bank') {
          updatedItem.balance = newBalance;
        } else {
          updatedItem.balanceUSD = newBalance;
        }
        setItemData(updatedItem);
  
        // Prepare transaction data
        const transactionData = {
          [`${type}Id`]: item.id,
          [`${type}Name`]: item.name,
          type: newAction.type,
          amount: amount,
          newBalance: newBalance,
          description: newAction.description || '',
          date: getTodayDate(),
          timestamp: new Date().toISOString(),
          createdAt: getTodayDate(),
        };
  
        // Save to Firestore
        const docRef = await addDoc(collection(db, `${type}s/${item.id}/transactions`), transactionData);
        const transactionWithId = { id: docRef.id, ...transactionData };
  
        // Add at beginning and sort by timestamp (newest first)
        const updatedTransactions = [transactionWithId, ...transactions];
        updatedTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setTransactions(updatedTransactions);
        await AsyncStorage.setItem(`${type}_transactions_${item.id}`, JSON.stringify(updatedTransactions));
  
        // Update in Firestore
        const updateData = type === 'bank' 
          ? { balance: newBalance, updatedAt: getTodayDate() }
          : { balanceUSD: newBalance, updatedAt: getTodayDate() };
  
        await updateDoc(doc(db, `${type}s`, item.id), updateData);
  
        Alert.alert('Success', `${newAction.type === 'deposit' ? 'Deposit' : 'Withdrawal'} saved to cloud!`);
        setActionModalVisible(false);
        setNewAction({ type: 'deposit', amount: '', description: '', date: getTodayDate() });
      } catch (error) {
        console.error(`Error saving ${type} action:`, error);
        Alert.alert('Error', `Failed to save: ${error.message}`);
        // Revert changes
        loadTransactions();
        loadTransactionsFromStorage();
      }
    };
  
    const updateItem = async () => {
      if (!editData.name.trim()) {
        Alert.alert('Error', `${type === 'bank' ? 'Bank' : 'Wallet'} name is required`);
        return;
      }
  
      try {
        const updateData = {
          name: editData.name,
          updatedAt: getTodayDate(),
        };
  
        if (type === 'bank') {
          updateData.account = editData.account || '';
        } else {
          updateData.address = editData.address || '';
        }
  
        // Update UI immediately
        const updatedItem = { ...itemData, ...updateData };
        setItemData(updatedItem);
  
        // Update in Firestore
        await updateDoc(doc(db, `${type}s`, item.id), updateData);
  
        Alert.alert('Success', `${type === 'bank' ? 'Bank' : 'Wallet'} updated in cloud!`);
        setEditModalVisible(false);
      } catch (error) {
        console.error(`Error updating ${type}:`, error);
        Alert.alert('Error', `Failed to update ${type === 'bank' ? 'bank' : 'wallet'}`);
      }
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
                if (transactionToDelete.type === 'deposit') {
                  balanceChange = -(transactionToDelete.amount || 0); // Reverse deposit
                } else if (transactionToDelete.type === 'withdraw') {
                  balanceChange = transactionToDelete.amount || 0; // Reverse withdrawal
                }
                
                const currentBalance = type === 'bank' 
                  ? parseFloat(itemData.balance) || 0
                  : parseFloat(itemData.balanceUSD) || 0;
                const newBalance = currentBalance + balanceChange;
                
                // Delete from Firestore
                await deleteDoc(doc(db, `${type}s/${item.id}/transactions`, transactionId));
                
                const updatedTransactions = transactions.filter(t => t.id !== transactionId);
                updatedTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                setTransactions(updatedTransactions);
                await AsyncStorage.setItem(`${type}_transactions_${item.id}`, JSON.stringify(updatedTransactions));
                
                // Update item balance
                const updatedItem = { ...itemData };
                if (type === 'bank') {
                  updatedItem.balance = newBalance;
                } else {
                  updatedItem.balanceUSD = newBalance;
                }
                setItemData(updatedItem);
                
                // Update in Firestore
                const updateData = type === 'bank' 
                  ? { balance: newBalance, updatedAt: getTodayDate() }
                  : { balanceUSD: newBalance, updatedAt: getTodayDate() };
                
                await updateDoc(doc(db, `${type}s`, item.id), updateData);
                
                Alert.alert('Success', 'Transaction deleted from cloud!');
              } catch (error) {
                console.error('Error deleting transaction:', error);
                Alert.alert('Error', 'Failed to delete transaction');
              }
            },
          },
        ]
      );
    };
  
    const editTransaction = (transaction) => {
      Alert.alert(
        'Edit Transaction',
        'Editing transactions is complex. Would you like to delete and create a new one instead?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete & Create New',
            style: 'destructive',
            onPress: () => {
              // First delete the transaction
              deleteTransaction(transaction.id);
              // Then pre-fill the action modal
              setNewAction({
                type: transaction.type,
                amount: transaction.amount.toString(),
                description: transaction.description || '',
                date: transaction.date,
              });
              setActionModalVisible(true);
            },
          },
        ]
      );
    };
  
    const getBalanceDisplay = () => {
      if (type === 'bank') {
        return formatCurrency(itemData.balance || 0);
      } else {
        return formatUSD(itemData.balanceUSD || 0);
      }
    };
  
    const getBalance = () => {
      if (type === 'bank') {
        return parseFloat(itemData.balance) || 0;
      } else {
        return parseFloat(itemData.balanceUSD) || 0;
      }
    };
  
    return (
      <View style={styles.container}>
        {/* Header Section */}
        <View style={[
          styles.detailsHeader,
          type === 'bank' ? styles.bankHeader : styles.walletHeader
        ]}>
          <View style={styles.headerContent}>
            <Text style={styles.detailsName}>{itemData.name}</Text>
            
            {type === 'bank' && itemData.account && (
              <View style={styles.infoRow}>
                <Icon name="account-balance" size={16} color="white" />
                <Text style={styles.detailsInfo}>Account: {itemData.account}</Text>
              </View>
            )}
            
            {type === 'wallet' && itemData.address && (
              <View style={styles.infoRow}>
                <Icon name="account-balance-wallet" size={16} color="white" />
                <Text style={styles.detailsInfo}>Address: {itemData.address}</Text>
              </View>
            )}
          </View>
          
          <View style={[
            styles.balanceCard,
            getBalance() >= 0 ? styles.balancePositive : styles.balanceNegative
          ]}>
            <Text style={styles.balanceLabel}>
              {type === 'bank' ? 'Available Balance' : 'Wallet Balance'}
            </Text>
            <Text style={styles.balanceValue}>
              {getBalanceDisplay()}
            </Text>
            <View style={styles.balanceBadge}>
              <Text style={styles.balanceBadgeText}>
                {type === 'bank' ? '🏦 BANK' : '💳 WALLET'}
              </Text>
            </View>
            <Text style={styles.transactionCount}>
              {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
  
        {/* Action Buttons */}
        <View style={styles.detailsActionButtons}>
          <TouchableOpacity 
            style={[styles.detailsActionButton, styles.depositActionButton]}
            onPress={() => {
              setNewAction({ type: 'deposit', amount: '', description: '', date: getTodayDate() });
              setActionModalVisible(true);
            }}
          >
            <Icon name="add-circle" size={22} color="white" />
            <Text style={styles.detailsActionButtonText}>Deposit</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.detailsActionButton, styles.withdrawActionButton]}
            onPress={() => {
              setNewAction({ type: 'withdraw', amount: '', description: '', date: getTodayDate() });
              setActionModalVisible(true);
            }}
          >
            <Icon name="remove-circle" size={22} color="white" />
            <Text style={styles.detailsActionButtonText}>Withdraw</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.detailsActionButton, styles.editActionButton]}
            onPress={() => {
              setEditData({
                name: itemData.name,
                account: itemData.account || '',
                address: itemData.address || '',
              });
              setEditModalVisible(true);
            }}
          >
            <Icon name="edit" size={22} color="white" />
            <Text style={styles.detailsActionButtonText}>Edit</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.detailsActionButton, styles.refreshActionButton]}
            onPress={onRefresh}
          >
            <Icon name="refresh" size={22} color="white" />
            <Text style={styles.detailsActionButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
  
        {/* Transaction History */}
        <View style={styles.transactionSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📅 Transaction History</Text>
            <Text style={styles.sortText}>Sorted: Newest First</Text>
          </View>
          
          <FlatList
            data={transactions}
            keyExtractor={(item) => item.id}
            refreshing={refreshing}
            onRefresh={onRefresh}
            renderItem={({ item: transaction, index }) => (
              <TouchableOpacity 
                key={transaction.id}
                style={[
                  styles.transactionCard,
                  transaction.type === 'deposit' ? styles.depositCard : styles.withdrawCard
                ]}
                onPress={() => editTransaction(transaction)}
                onLongPress={() => deleteTransaction(transaction.id)}
              >
                <View style={styles.transactionHeader}>
                  <View style={styles.transactionTypeContainer}>
                    <Text style={styles.transactionIndex}>#{index + 1}</Text>
                    <View style={[
                      styles.transactionIcon,
                      transaction.type === 'deposit' ? styles.depositIcon : styles.withdrawIcon
                    ]}>
                      <Icon 
                        name={transaction.type === 'deposit' ? 'arrow-upward' : 'arrow-downward'} 
                        size={16} 
                        color="white" 
                      />
                    </View>
                    <View>
                      <Text style={styles.transactionType}>
                        {transaction.type === 'deposit' ? 'Deposit' : 'Withdrawal'}
                      </Text>
                      <Text style={styles.transactionDate}>{transaction.date}</Text>
                    </View>
                  </View>
                  <Text style={[
                    styles.transactionAmount,
                    transaction.type === 'deposit' ? styles.depositAmount : styles.withdrawAmount
                  ]}>
                    {transaction.type === 'deposit' ? '+' : '-'}{' '}
                    {type === 'bank' ? formatCurrency(transaction.amount) : formatUSD(transaction.amount)}
                  </Text>
                </View>
                
                <View style={styles.transactionDetails}>
                  <Text style={styles.transactionBalance}>
                    New Balance: {type === 'bank' ? formatCurrency(transaction.newBalance) : formatUSD(transaction.newBalance)}
                  </Text>
                  {transaction.description && (
                    <Text style={styles.transactionDescription}>Note: {transaction.description}</Text>
                  )}
                </View>
                
                <View style={styles.transactionFooter}>
                  <Text style={styles.transactionTime}>
                    {new Date(transaction.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </Text>
                  <View style={styles.transactionActions}>
                    <TouchableOpacity 
                      style={styles.smallEditButton}
                      onPress={() => editTransaction(transaction)}
                    >
                      <Icon name="edit" size={14} color="#007AFF" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.smallDeleteButton}
                      onPress={() => deleteTransaction(transaction.id)}
                    >
                      <Icon name="delete" size={14} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyTransactionState}>
                <Icon name="receipt" size={64} color="#ccc" />
                <Text style={styles.emptyTransactionText}>No transactions yet</Text>
                <Text style={styles.emptyTransactionSubtext}>Make your first deposit to get started</Text>
              </View>
            }
          />
        </View>
  
        {/* Action Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={actionModalVisible}
          onRequestClose={() => setActionModalVisible(false)}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {newAction.type === 'deposit' ? '💵 Deposit' : '💰 Withdraw'}
              </Text>
              
              <View style={styles.modalInfo}>
                <Icon 
                  name={type === 'bank' ? 'account-balance' : 'account-balance-wallet'} 
                  size={24} 
                  color="#007AFF" 
                />
                <Text style={styles.modalInfoText}>{itemData.name}</Text>
              </View>
              
              <Text style={styles.currentBalance}>
                Current Balance: {getBalanceDisplay()}
              </Text>
              
              <View style={styles.radioGroup}>
                <TouchableOpacity
                  style={[
                    styles.radioButton,
                    newAction.type === 'deposit' && styles.radioButtonSelected
                  ]}
                  onPress={() => setNewAction({...newAction, type: 'deposit'})}
                >
                  <Icon name="add-circle" size={20} color={newAction.type === 'deposit' ? 'white' : '#495057'} />
                  <Text style={newAction.type === 'deposit' ? styles.radioButtonTextSelected : styles.radioButtonText}>
                    Deposit
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.radioButton,
                    newAction.type === 'withdraw' && styles.radioButtonSelected
                  ]}
                  onPress={() => setNewAction({...newAction, type: 'withdraw'})}
                >
                  <Icon name="remove-circle" size={20} color={newAction.type === 'withdraw' ? 'white' : '#495057'} />
                  <Text style={newAction.type === 'withdraw' ? styles.radioButtonTextSelected : styles.radioButtonText}>
                    Withdraw
                  </Text>
                </TouchableOpacity>
              </View>
              
              <TextInput
                style={styles.input}
                placeholder={type === 'bank' ? "Amount (BDT)" : "Amount (USD)"}
                value={newAction.amount}
                onChangeText={(text) => setNewAction({...newAction, amount: text})}
                keyboardType="numeric"
              />
              
              {newAction.amount && (
                <View style={styles.calculationBox}>
                  <Text style={styles.calculationText}>
                    Current: {getBalanceDisplay()}
                  </Text>
                  <Text style={[
                    styles.calculationText,
                    newAction.type === 'deposit' ? styles.depositText : styles.withdrawText
                  ]}>
                    {newAction.type === 'deposit' ? '+' : '-'} {type === 'bank' ? formatCurrency(parseFloat(newAction.amount) || 0) : formatUSD(parseFloat(newAction.amount) || 0)}
                  </Text>
                  <View style={styles.calculationDivider} />
                  <Text style={[styles.calculationText, styles.boldText]}>
                    New Balance: {type === 'bank' 
                      ? formatCurrency(
                          newAction.type === 'deposit' 
                            ? getBalance() + (parseFloat(newAction.amount) || 0)
                            : getBalance() - (parseFloat(newAction.amount) || 0)
                        )
                      : formatUSD(
                          newAction.type === 'deposit' 
                            ? getBalance() + (parseFloat(newAction.amount) || 0)
                            : getBalance() - (parseFloat(newAction.amount) || 0)
                        )}
                  </Text>
                </View>
              )}
              
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Description (Optional)"
                value={newAction.description}
                onChangeText={(text) => setNewAction({...newAction, description: text})}
                multiline
                numberOfLines={3}
              />
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setActionModalVisible(false)}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={saveAction}
                >
                  <Text style={styles.modalButtonText}>
                    {newAction.type === 'deposit' ? 'Deposit' : 'Withdraw'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
  
        {/* Edit Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={editModalVisible}
          onRequestClose={() => setEditModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                Edit {type === 'bank' ? '🏦 Bank' : '💳 Wallet'}
              </Text>
              
              <TextInput
                style={styles.input}
                placeholder={`${type === 'bank' ? 'Bank' : 'Wallet'} Name *`}
                value={editData.name}
                onChangeText={(text) => setEditData({...editData, name: text})}
              />
              
              {type === 'bank' ? (
                <TextInput
                  style={styles.input}
                  placeholder="Account Number (Optional)"
                  value={editData.account}
                  onChangeText={(text) => setEditData({...editData, account: text})}
                />
              ) : (
                <TextInput
                  style={styles.input}
                  placeholder="Wallet Address (Optional)"
                  value={editData.address}
                  onChangeText={(text) => setEditData({...editData, address: text})}
                />
              )}
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setEditModalVisible(false)}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={updateItem}
                >
                  <Text style={styles.modalButtonText}>Update</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
}