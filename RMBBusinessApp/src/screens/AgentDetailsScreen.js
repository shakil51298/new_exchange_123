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
  } from 'react-native';
  import Icon from 'react-native-vector-icons/MaterialIcons';  
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
  
    const [refreshing, setRefreshing] = useState(false);
  
    useEffect(() => {
      loadTransactions();
    }, []);
  
    const loadTransactions = async () => {
      try {
        // Try to load from Firestore first
        const transactionsRef = collection(db, `agents/${agent.id}/transactions`);
        const querySnapshot = await getDocs(transactionsRef);
        const transactionsList = [];
        querySnapshot.forEach((doc) => {
          transactionsList.push({ id: doc.id, ...doc.data() });
        });
        // Sort by date descending (newest first)
        transactionsList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setTransactions(transactionsList);
        // Also save to AsyncStorage for backup
        await AsyncStorage.setItem(`agent_transactions_${agent.id}`, JSON.stringify(transactionsList));
      } catch (error) {
        console.error('Error loading transactions from Firestore:', error);
        // Fallback to AsyncStorage
        const storedTransactions = await AsyncStorage.getItem(`agent_transactions_${agent.id}`);
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
          agentId: agent.id,
          agentName: agent.name,
          type: type, // 'dhs' or 'payment'
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
        if (type === 'dhs') {
          balanceChange = data.bdtAmount || 0; // DHS increases what you owe
        } else if (type === 'payment') {
          // Convert DHS payment to BDT
          const dhsAmount = data.amountDHS || 0;
          const rate = data.dhsRate || 34.24;
          const bdtAmount = dhsAmount * rate;
          balanceChange = -bdtAmount; // Payment decreases what you owe
        }
  
        const currentBalance = parseFloat(agentData.balance) || 0;
        const newBalance = currentBalance + balanceChange;
  
        if (isEdit && editingTransaction.id) {
          // For edits, reverse old transaction first
          const oldTransaction = transactions.find(t => t.id === editingTransaction.id);
          let oldBalanceChange = 0;
          
          if (oldTransaction.type === 'dhs') {
            oldBalanceChange = -(oldTransaction.bdtAmount || 0); // Reverse old DHS
          } else if (oldTransaction.type === 'payment') {
            // Reverse old payment
            const oldDhsAmount = oldTransaction.amountDHS || 0;
            const oldRate = oldTransaction.dhsRate || 34.24;
            oldBalanceChange = oldDhsAmount * oldRate; // Reverse payment (add back)
          }
          
          // Calculate with reversed old transaction
          const balanceAfterReverse = currentBalance + oldBalanceChange;
          const finalBalance = balanceAfterReverse + balanceChange;
          
          // Update in Firestore
          const updateData = { ...newTransaction };
          delete updateData.id;
          delete updateData.createdAt;
          
          await updateDoc(doc(db, `agents/${agent.id}/transactions`, editingTransaction.id), updateData);
          
          // Update local state - NEWEST FIRST
          const updatedTransactions = transactions.map(t => 
            t.id === editingTransaction.id ? { ...t, ...newTransaction } : t
          );
          updatedTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          setTransactions(updatedTransactions);
          
          // Also save to AsyncStorage
          await AsyncStorage.setItem(`agent_transactions_${agent.id}`, JSON.stringify(updatedTransactions));
          
          // Update agent balance
          const updatedAgent = { ...agentData, balance: finalBalance };
          setAgentData(updatedAgent);
          
          // Update in Firestore agents collection
          await updateDoc(doc(db, 'agents', agent.id), { 
            balance: finalBalance, 
            updatedAt: getTodayDate() 
          });
          
          // Update in AsyncStorage agents list
          const storedAgents = await AsyncStorage.getItem('agents');
          if (storedAgents) {
            const agents = JSON.parse(storedAgents);
            const updatedAgents = agents.map(a => 
              a.id === agent.id ? updatedAgent : a
            );
            await AsyncStorage.setItem('agents', JSON.stringify(updatedAgents));
          }
        } else {
          // For new transactions - add createdAt
          newTransaction.createdAt = getTodayDate();
          
          // Save to Firestore
          const docRef = await addDoc(collection(db, `agents/${agent.id}/transactions`), newTransaction);
          const transactionWithId = { id: docRef.id, ...newTransaction };
          
          // Add at beginning and sort by timestamp (newest first)
          const updatedTransactions = [transactionWithId, ...transactions];
          updatedTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          setTransactions(updatedTransactions);
          
          // Also save to AsyncStorage
          await AsyncStorage.setItem(`agent_transactions_${agent.id}`, JSON.stringify(updatedTransactions));
  
          // Update agent balance
          const updatedAgent = { ...agentData, balance: newBalance };
          setAgentData(updatedAgent);
  
          // Update in Firestore agents collection
          await updateDoc(doc(db, 'agents', agent.id), { 
            balance: newBalance,
            updatedAt: getTodayDate() 
          });
          
          // Update in AsyncStorage agents list
          const storedAgents = await AsyncStorage.getItem('agents');
          if (storedAgents) {
            const agents = JSON.parse(storedAgents);
            const updatedAgents = agents.map(a => 
              a.id === agent.id ? updatedAgent : a
            );
            await AsyncStorage.setItem('agents', JSON.stringify(updatedAgents));
          }
        }
  
        Alert.alert('Success', `${isEdit ? 'Transaction updated' : 'Transaction saved'} to cloud!`);
        
        // Reset forms
        if (type === 'dhs') {
          setDhsModalVisible(false);
          setNewDHS({ bdtAmount: '', dhsRate: '34.24', description: '', date: getTodayDate() });
        } else if (type === 'payment') {
          setPaymentModalVisible(false);
          setNewPayment({ amountDHS: '', dhsRate: '34.24', description: '', date: getTodayDate() });
        }
        if (isEdit) {
          setEditModalVisible(false);
          setEditingTransaction({ 
            id: '', type: '', bdtAmount: '', dhsRate: '', dhsAmount: '',
            amountDHS: '', description: '', calculation: '', date: getTodayDate(), timestamp: ''
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
        agentId: agent.id,
        agentName: agent.name,
        type: type, // 'dhs' or 'payment'
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
      await AsyncStorage.setItem(`agent_transactions_${agent.id}`, JSON.stringify(updatedTransactions));
  
      // Update agent balance locally
      let balanceChange = 0;
      if (type === 'dhs') {
        balanceChange = data.bdtAmount || 0;
      } else if (type === 'payment') {
        // Convert DHS payment to BDT
        const dhsAmount = data.amountDHS || 0;
        const rate = data.dhsRate || 34.24;
        const bdtAmount = dhsAmount * rate;
        balanceChange = -bdtAmount;
      }
  
      const currentBalance = parseFloat(agentData.balance) || 0;
      const newBalance = currentBalance + balanceChange;
      const updatedAgent = { ...agentData, balance: newBalance };
      setAgentData(updatedAgent);
  
      // Update in main agents list locally
      const storedAgents = await AsyncStorage.getItem('agents');
      if (storedAgents) {
        const agents = JSON.parse(storedAgents);
        const updatedAgents = agents.map(a => 
          a.id === agent.id ? updatedAgent : a
        );
        await AsyncStorage.setItem('agents', JSON.stringify(updatedAgents));
      }
  
      Alert.alert('Saved locally', `${isEdit ? 'Transaction updated' : 'Transaction saved'} to device`);
      
      // Reset forms
      if (type === 'dhs') {
        setDhsModalVisible(false);
        setNewDHS({ bdtAmount: '', dhsRate: '34.24', description: '', date: getTodayDate() });
      } else if (type === 'payment') {
        setPaymentModalVisible(false);
        setNewPayment({ amountDHS: '', dhsRate: '34.24', description: '', date: getTodayDate() });
      }
      if (isEdit) {
        setEditModalVisible(false);
        setEditingTransaction({ 
          id: '', type: '', bdtAmount: '', dhsRate: '', dhsAmount: '',
          amountDHS: '', description: '', calculation: '', date: getTodayDate(), timestamp: ''
        });
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
        bdtAmount: bdtAmount,
        dhsRate: rate,
        dhsAmount: dhsAmount,
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
        bdtAmount: bdtAmount,
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
        
        saveTransaction('dhs', {
          bdtAmount: bdtAmount,
          dhsRate: rate,
          dhsAmount: dhsAmount,
          calculation: `${bdtAmount} BDT ÷ ${rate} = ${dhsAmount.toFixed(2)} DHS`,
          description: editingTransaction.description,
          date: editingTransaction.date,
        }, true);
      } else if (editingTransaction.type === 'payment') {
        if (!editingTransaction.amountDHS || !editingTransaction.dhsRate) {
          Alert.alert('Error', 'Please enter DHS amount and rate');
          return;
        }
        
        const dhsAmount = parseFloat(editingTransaction.amountDHS) || 0;
        const rate = parseFloat(editingTransaction.dhsRate) || 34.24;
        const bdtAmount = dhsAmount * rate;
        
        saveTransaction('payment', {
          amountDHS: dhsAmount,
          dhsRate: rate,
          bdtAmount: bdtAmount,
          calculation: `${dhsAmount} DHS × ${rate} = ${bdtAmount.toFixed(2)} BDT`,
          description: editingTransaction.description,
          date: editingTransaction.date,
        }, true);
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
                if (transactionToDelete.type === 'dhs') {
                  balanceChange = -(transactionToDelete.bdtAmount || 0); // Reverse DHS
                } else if (transactionToDelete.type === 'payment') {
                  // Reverse payment
                  balanceChange = transactionToDelete.bdtAmount || 0;
                }
                
                const currentBalance = parseFloat(agentData.balance) || 0;
                const newBalance = currentBalance + balanceChange;
                
                // Delete from Firestore
                await deleteDoc(doc(db, `agents/${agent.id}/transactions`, transactionId));
                
                const updatedTransactions = transactions.filter(t => t.id !== transactionId);
                updatedTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                setTransactions(updatedTransactions);
                await AsyncStorage.setItem(`agent_transactions_${agent.id}`, JSON.stringify(updatedTransactions));
                
                // Update agent balance
                const updatedAgent = { ...agentData, balance: newBalance };
                setAgentData(updatedAgent);
                
                // Update in Firestore
                await updateDoc(doc(db, 'agents', agent.id), { 
                  balance: newBalance,
                  updatedAt: getTodayDate()
                });
                
                // Update in AsyncStorage
                const storedAgents = await AsyncStorage.getItem('agents');
                if (storedAgents) {
                  const agents = JSON.parse(storedAgents);
                  const updatedAgents = agents.map(a => 
                    a.id === agent.id ? updatedAgent : a
                  );
                  await AsyncStorage.setItem('agents', JSON.stringify(updatedAgents));
                }
                
                Alert.alert('Success', 'Transaction deleted from cloud!');
              } catch (error) {
                console.error('Error deleting transaction:', error);
                // Fallback to AsyncStorage
                const transactionToDelete = transactions.find(t => t.id === transactionId);
                if (!transactionToDelete) return;
                
                let balanceChange = 0;
                if (transactionToDelete.type === 'dhs') {
                  balanceChange = -(transactionToDelete.bdtAmount || 0);
                } else if (transactionToDelete.type === 'payment') {
                  balanceChange = transactionToDelete.bdtAmount || 0;
                }
                
                const currentBalance = parseFloat(agentData.balance) || 0;
                const newBalance = currentBalance + balanceChange;
                
                const updatedTransactions = transactions.filter(t => t.id !== transactionId);
                updatedTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                setTransactions(updatedTransactions);
                await AsyncStorage.setItem(`agent_transactions_${agent.id}`, JSON.stringify(updatedTransactions));
                
                const updatedAgent = { ...agentData, balance: newBalance };
                setAgentData(updatedAgent);
                
                // Update in main agents list locally
                const storedAgents = await AsyncStorage.getItem('agents');
                if (storedAgents) {
                  const agents = JSON.parse(storedAgents);
                  const updatedAgents = agents.map(a => 
                    a.id === agent.id ? updatedAgent : a
                  );
                  await AsyncStorage.setItem('agents', JSON.stringify(updatedAgents));
                }
                
                Alert.alert('Deleted locally', 'Transaction deleted from device');
              }
            },
          },
        ]
      );
    };
  
    // Calculate DHS balance from all transactions
    const calculateDHSBalance = () => {
      let dhsBalance = 0;
      transactions.forEach(t => {
        if (t.type === 'dhs') {
          dhsBalance += (t.dhsAmount || 0);
        } else if (t.type === 'payment') {
          dhsBalance -= (t.amountDHS || 0);
        }
      });
      return dhsBalance;
    };
  
    const dhsBalance = calculateDHSBalance();
  
    return (
      <View style={styles.container}>
        <View style={styles.agentHeader}>
          <Text style={styles.customerName}>{agentData.name}</Text>
          
          {agentData.contact && (
            <Text style={styles.customerContact}>📞 {agentData.contact}</Text>
          )}
          
          <View style={[
            styles.balanceCard,
            agentData.balance > 0 ? styles.balanceOwe : 
            agentData.balance < 0 ? styles.balanceReceive : styles.balanceNeutral
          ]}>
            <Text style={styles.balanceTitle}>
              {agentData.balance > 0 ? 'You Owe Agent' : 
               agentData.balance < 0 ? 'Agent Owes You' : 'Balance Settled'}
            </Text>
            <Text style={styles.balanceAmount}>
              {formatCurrency(Math.abs(agentData.balance))}
            </Text>
            
            {/* DHS Balance Display */}
            <View style={styles.dhsBalanceContainer}>
              <Text style={styles.dhsBalanceLabel}>DHS Balance:</Text>
              <Text style={[
                styles.dhsBalanceAmount,
                dhsBalance >= 0 ? styles.positiveBalance : styles.negativeBalance
              ]}>
                {dhsBalance.toFixed(2)} DHS
              </Text>
            </View>
            
            {usdRate && (
              <View style={styles.conversionContainer}>
                <Text style={styles.conversionText}>
                  Value in USD: ${(Math.abs(agentData.balance) / parseFloat(usdRate || 125)).toFixed(2)}
                </Text>
              </View>
            )}
            
            <Text style={styles.transactionCount}>
              {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
  
        {/* USD Rate Input */}
        <View style={styles.rateInputContainer}>
          <Text style={styles.rateLabel}>USD Rate (BDT per $):</Text>
          <TextInput
            style={styles.rateInput}
            value={usdRate}
            onChangeText={setUsdRate}
            keyboardType="numeric"
            placeholder="125"
          />
        </View>
  
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionButtonLarge, styles.dhsButton]}
            onPress={() => setDhsModalVisible(true)}
          >
            <Icon name="currency-exchange" size={24} color="white" />
            <Text style={styles.actionButtonText}>New DHS</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButtonLarge, styles.paymentButton]}
            onPress={() => setPaymentModalVisible(true)}
          >
            <Icon name="payment" size={24} color="white" />
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
                    {item.type === 'dhs' ? '🏦 DHS' : '💵 PAYMENT'}
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
                    <Text style={[styles.transactionValue, styles.boldText]}>
                      {item.dhsAmount?.toFixed(2)} DHS
                    </Text>
                  </View>
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
                      {item.amountDHS?.toFixed(2)} DHS
                    </Text>
                  </View>
                  <View style={styles.transactionRow}>
                    <Text style={styles.transactionLabel}>DHS Rate:</Text>
                    <Text style={styles.transactionValue}>{item.dhsRate} BDT/DHS</Text>
                  </View>
                  <View style={styles.transactionRow}>
                    <Text style={styles.transactionLabel}>BDT Value:</Text>
                    <Text style={styles.transactionValue}>{formatCurrency(item.bdtAmount)}</Text>
                  </View>
                  {item.description && (
                    <View style={styles.notesContainer}>
                      <Text style={styles.notesLabel}>Note:</Text>
                      <Text style={styles.notesText}>{item.description}</Text>
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          )}
          
          ListEmptyComponent={
            <View style={styles.emptyTransactionState}>
              <Icon name="receipt" size={64} color="#ccc" />
              <Text style={styles.emptyTransactionText}>No transactions yet</Text>
              <Text style={styles.emptyTransactionSubtext}>Add your first DHS record or payment</Text>
            </View>
          }
        />
  
        {/* New DHS Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={dhsModalVisible}
          onRequestClose={() => setDhsModalVisible(false)}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>🏦 New DHS Record</Text>
              
              <TextInput
                style={styles.input}
                placeholder="BDT Amount"
                value={newDHS.bdtAmount}
                onChangeText={(text) => setNewDHS({...newDHS, bdtAmount: text})}
                keyboardType="numeric"
              />
              
              <TextInput
                style={styles.input}
                placeholder="DHS Rate (BDT per DHS)"
                value={newDHS.dhsRate}
                onChangeText={(text) => setNewDHS({...newDHS, dhsRate: text})}
                keyboardType="numeric"
              />
              
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Description (Optional)"
                value={newDHS.description}
                onChangeText={(text) => setNewDHS({...newDHS, description: text})}
                multiline
                numberOfLines={2}
              />
              
              {newDHS.bdtAmount && newDHS.dhsRate && (
                <View style={styles.calculationBox}>
                  <Text style={styles.calculationText}>
                    DHS Amount: {((parseFloat(newDHS.bdtAmount) || 0) / (parseFloat(newDHS.dhsRate) || 34.24)).toFixed(2)} DHS
                  </Text>
                  <Text style={styles.calculationFormula}>
                    {newDHS.bdtAmount} BDT ÷ {newDHS.dhsRate} = {((parseFloat(newDHS.bdtAmount) || 0) / (parseFloat(newDHS.dhsRate) || 34.24)).toFixed(2)} DHS
                  </Text>
                </View>
              )}
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setDhsModalVisible(false)}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleNewDHS}
                >
                  <Text style={styles.modalButtonText}>Save DHS</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
  
        {/* Payment Modal (in DHS) */}
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
              <Text style={styles.modalTitle}>💵 Make Payment (in DHS)</Text>
              
              <TextInput
                style={styles.input}
                placeholder="Amount in DHS"
                value={newPayment.amountDHS}
                onChangeText={(text) => setNewPayment({...newPayment, amountDHS: text})}
                keyboardType="numeric"
              />
              
              <TextInput
                style={styles.input}
                placeholder="DHS Rate (BDT per DHS)"
                value={newPayment.dhsRate}
                onChangeText={(text) => setNewPayment({...newPayment, dhsRate: text})}
                keyboardType="numeric"
              />
              
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Description (Optional)"
                value={newPayment.description}
                onChangeText={(text) => setNewPayment({...newPayment, description: text})}
                multiline
                numberOfLines={2}
              />
              
              {newPayment.amountDHS && newPayment.dhsRate && (
                <View style={styles.calculationBox}>
                  <Text style={styles.calculationText}>
                    BDT Value: {formatCurrency((parseFloat(newPayment.amountDHS) || 0) * (parseFloat(newPayment.dhsRate) || 34.24))}
                  </Text>
                  <Text style={styles.calculationFormula}>
                    {newPayment.amountDHS} DHS × {newPayment.dhsRate} = {((parseFloat(newPayment.amountDHS) || 0) * (parseFloat(newPayment.dhsRate) || 34.24)).toFixed(2)} BDT
                  </Text>
                </View>
              )}
              
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
                ✏️ Edit {editingTransaction.type === 'dhs' ? 'DHS Record' : 'Payment'}
              </Text>
              
              {editingTransaction.type === 'dhs' ? (
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
                    placeholder="DHS Rate (BDT per DHS)"
                    value={editingTransaction.dhsRate}
                    onChangeText={(text) => setEditingTransaction({...editingTransaction, dhsRate: text})}
                    keyboardType="numeric"
                  />
                  
                  {editingTransaction.bdtAmount && editingTransaction.dhsRate && (
                    <View style={styles.calculationBox}>
                      <Text style={styles.calculationText}>
                        DHS Amount: {((parseFloat(editingTransaction.bdtAmount) || 0) / (parseFloat(editingTransaction.dhsRate) || 34.24)).toFixed(2)} DHS
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Amount in DHS"
                    value={editingTransaction.amountDHS}
                    onChangeText={(text) => setEditingTransaction({...editingTransaction, amountDHS: text})}
                    keyboardType="numeric"
                  />
                  
                  <TextInput
                    style={styles.input}
                    placeholder="DHS Rate (BDT per DHS)"
                    value={editingTransaction.dhsRate}
                    onChangeText={(text) => setEditingTransaction({...editingTransaction, dhsRate: text})}
                    keyboardType="numeric"
                  />
                  
                  {editingTransaction.amountDHS && editingTransaction.dhsRate && (
                    <View style={styles.calculationBox}>
                      <Text style={styles.calculationText}>
                        BDT Value: {formatCurrency((parseFloat(editingTransaction.amountDHS) || 0) * (parseFloat(editingTransaction.dhsRate) || 34.24))}
                      </Text>
                    </View>
                  )}
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
