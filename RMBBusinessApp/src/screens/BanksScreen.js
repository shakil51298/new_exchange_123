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
  import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    getDocs,
    onSnapshot,
  } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { db } from '../config/firebase';
import styles from '../styles/styles';

import { formatCurrency, formatUSD } from '../utils/format';
import { getTodayDate } from '../utils/date';

export default function BanksScreen({ navigation }) {
    const [banks, setBanks] = useState([]);
    const [wallets, setWallets] = useState([]);
    const [filteredBanks, setFilteredBanks] = useState([]);
    const [filteredWallets, setFilteredWallets] = useState([]);
    const [bankModalVisible, setBankModalVisible] = useState(false);
    const [walletModalVisible, setWalletModalVisible] = useState(false);
    const [bankActionModalVisible, setBankActionModalVisible] = useState(false);
    const [walletActionModalVisible, setWalletActionModalVisible] = useState(false);
    const [bankSearchQuery, setBankSearchQuery] = useState('');
    const [walletSearchQuery, setWalletSearchQuery] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    
    const [currentBank, setCurrentBank] = useState({
      id: '',
      name: '',
      account: '',
      balance: '0',
    });
    
    const [currentWallet, setCurrentWallet] = useState({
      id: '',
      name: '',
      address: '',
      balanceUSD: '0',
    });
    
    const [bankAction, setBankAction] = useState({
      type: 'deposit',
      amount: '',
      description: '',
      date: getTodayDate(),
    });
    
    const [walletAction, setWalletAction] = useState({
      type: 'deposit',
      amountUSD: '',
      description: '',
      date: getTodayDate(),
    });
  
    // Load banks and wallets from Firestore
    useEffect(() => {
      loadData();
    }, []);
  
    useEffect(() => {
      // Filter banks based on search query
      if (bankSearchQuery.trim() === '') {
        setFilteredBanks(banks);
      } else {
        const filtered = banks.filter(bank =>
          bank.name.toLowerCase().includes(bankSearchQuery.toLowerCase()) ||
          (bank.account && bank.account.includes(bankSearchQuery))
        );
        setFilteredBanks(filtered);
      }
    }, [bankSearchQuery, banks]);
  
    useEffect(() => {
      // Filter wallets based on search query
      if (walletSearchQuery.trim() === '') {
        setFilteredWallets(wallets);
      } else {
        const filtered = wallets.filter(wallet =>
          wallet.name.toLowerCase().includes(walletSearchQuery.toLowerCase()) ||
          (wallet.address && wallet.address.includes(walletSearchQuery))
        );
        setFilteredWallets(filtered);
      }
    }, [walletSearchQuery, wallets]);
  
    const loadData = async () => {
      try {
        const banksSnapshot = await getDocs(collection(db, 'banks'));
        const banksList = [];
        banksSnapshot.forEach((doc) => {
          banksList.push({ id: doc.id, ...doc.data() });
        });
        // Sort by updatedAt (newest first)
        banksList.sort((a, b) => {
          const dateA = a.updatedAt ? new Date(a.updatedAt) : new Date(a.createdAt || 0);
          const dateB = b.updatedAt ? new Date(b.updatedAt) : new Date(b.createdAt || 0);
          return dateB - dateA;
        });
        setBanks(banksList);
        setFilteredBanks(banksList);
        await AsyncStorage.setItem('banks', JSON.stringify(banksList));
  
        const walletsSnapshot = await getDocs(collection(db, 'wallets'));
        const walletsList = [];
        walletsSnapshot.forEach((doc) => {
          walletsList.push({ id: doc.id, ...doc.data() });
        });
        // Sort by updatedAt (newest first)
        walletsList.sort((a, b) => {
          const dateA = a.updatedAt ? new Date(a.updatedAt) : new Date(a.createdAt || 0);
          const dateB = b.updatedAt ? new Date(b.updatedAt) : new Date(b.createdAt || 0);
          return dateB - dateA;
        });
        setWallets(walletsList);
        setFilteredWallets(walletsList);
        await AsyncStorage.setItem('wallets', JSON.stringify(walletsList));
      } catch (error) {
        console.error('Error loading data:', error);
        loadFromStorage();
      }
    };
  
    const loadFromStorage = async () => {
      try {
        const storedBanks = await AsyncStorage.getItem('banks');
        const storedWallets = await AsyncStorage.getItem('wallets');
        
        if (storedBanks) {
          const banksList = JSON.parse(storedBanks);
          banksList.sort((a, b) => {
            const dateA = a.updatedAt ? new Date(a.updatedAt) : new Date(a.createdAt || 0);
            const dateB = b.updatedAt ? new Date(b.updatedAt) : new Date(b.createdAt || 0);
            return dateB - dateA;
          });
          setBanks(banksList);
          setFilteredBanks(banksList);
        }
        
        if (storedWallets) {
          const walletsList = JSON.parse(storedWallets);
          walletsList.sort((a, b) => {
            const dateA = a.updatedAt ? new Date(a.updatedAt) : new Date(a.createdAt || 0);
            const dateB = b.updatedAt ? new Date(b.updatedAt) : new Date(b.createdAt || 0);
            return dateB - dateA;
          });
          setWallets(walletsList);
          setFilteredWallets(walletsList);
        }
      } catch (error) {
        console.error('Error loading from storage:', error);
      }
    };
  
    const onRefresh = async () => {
      setRefreshing(true);
      await loadData();
      setRefreshing(false);
    };
  
    const saveBank = async () => {
      if (!currentBank.name.trim()) {
        Alert.alert('Error', 'Bank name is required');
        return;
      }
  
      const balanceValue = parseFloat(currentBank.balance) || 0;
  
      try {
        const bankData = {
          name: currentBank.name.trim(),
          account: currentBank.account?.trim() || '',
          balance: balanceValue,
          updatedAt: getTodayDate(),
        };
  
        // UPDATE UI IMMEDIATELY
        let updatedBanks;
        if (currentBank.id) {
          // Update in local state immediately
          updatedBanks = banks.map(b => 
            b.id === currentBank.id ? { 
              ...b, 
              ...bankData,
              id: currentBank.id
            } : b
          );
        } else {
          // Add to local state immediately with temporary ID
          const tempId = `temp_bank_${Date.now()}`;
          const newBank = {
            ...bankData,
            id: tempId,
            createdAt: getTodayDate(),
          };
          updatedBanks = [newBank, ...banks];
        }
  
        // Update state immediately
        setBanks(updatedBanks);
        setFilteredBanks(updatedBanks);
        await AsyncStorage.setItem('banks', JSON.stringify(updatedBanks));
  
        // Only add createdAt for new banks
        if (!currentBank.id) {
          bankData.createdAt = getTodayDate();
        }
  
        if (currentBank.id) {
          // Update existing bank in Firestore
          const updateData = { ...bankData };
          delete updateData.createdAt;
          
          await updateDoc(doc(db, 'banks', currentBank.id), updateData);
          Alert.alert('Success', 'Bank updated in cloud!');
        } else {
          // Add new bank to Firestore
          const docRef = await addDoc(collection(db, 'banks'), bankData);
          const newBank = { id: docRef.id, ...bankData };
          
          // Replace temporary ID with real Firestore ID
          const finalBanks = updatedBanks.map(b => 
            b.id.startsWith('temp_bank_') ? newBank : b
          );
          
          setBanks(finalBanks);
          setFilteredBanks(finalBanks);
          await AsyncStorage.setItem('banks', JSON.stringify(finalBanks));
          
          Alert.alert('Success', 'Bank saved to cloud!');
        }
  
        setBankModalVisible(false);
        setCurrentBank({ id: '', name: '', account: '', balance: '0' });
        
      } catch (error) {
        console.error('Error saving bank:', error);
        loadFromStorage();
        Alert.alert('Error', `Failed to save: ${error.message}`);
        setBankModalVisible(false);
        setCurrentBank({ id: '', name: '', account: '', balance: '0' });
      }
    };
  
    const saveWallet = async () => {
      if (!currentWallet.name.trim()) {
        Alert.alert('Error', 'Wallet name is required');
        return;
      }
  
      const balanceValue = parseFloat(currentWallet.balanceUSD) || 0;
  
      try {
        const walletData = {
          name: currentWallet.name.trim(),
          address: currentWallet.address?.trim() || '',
          balanceUSD: balanceValue,
          updatedAt: getTodayDate(),
        };
  
        // UPDATE UI IMMEDIATELY
        let updatedWallets;
        if (currentWallet.id) {
          // Update in local state immediately
          updatedWallets = wallets.map(w => 
            w.id === currentWallet.id ? { 
              ...w, 
              ...walletData,
              id: currentWallet.id
            } : w
          );
        } else {
          // Add to local state immediately with temporary ID
          const tempId = `temp_wallet_${Date.now()}`;
          const newWallet = {
            ...walletData,
            id: tempId,
            createdAt: getTodayDate(),
          };
          updatedWallets = [newWallet, ...wallets];
        }
  
        // Update state immediately
        setWallets(updatedWallets);
        setFilteredWallets(updatedWallets);
        await AsyncStorage.setItem('wallets', JSON.stringify(updatedWallets));
  
        // Only add createdAt for new wallets
        if (!currentWallet.id) {
          walletData.createdAt = getTodayDate();
        }
  
        if (currentWallet.id) {
          // Update existing wallet in Firestore
          const updateData = { ...walletData };
          delete updateData.createdAt;
          
          await updateDoc(doc(db, 'wallets', currentWallet.id), updateData);
          Alert.alert('Success', 'Wallet updated in cloud!');
        } else {
          // Add new wallet to Firestore
          const docRef = await addDoc(collection(db, 'wallets'), walletData);
          const newWallet = { id: docRef.id, ...walletData };
          
          // Replace temporary ID with real Firestore ID
          const finalWallets = updatedWallets.map(w => 
            w.id.startsWith('temp_wallet_') ? newWallet : w
          );
          
          setWallets(finalWallets);
          setFilteredWallets(finalWallets);
          await AsyncStorage.setItem('wallets', JSON.stringify(finalWallets));
          
          Alert.alert('Success', 'Wallet saved to cloud!');
        }
  
        setWalletModalVisible(false);
        setCurrentWallet({ id: '', name: '', address: '', balanceUSD: '0' });
        
      } catch (error) {
        console.error('Error saving wallet:', error);
        loadFromStorage();
        Alert.alert('Error', `Failed to save: ${error.message}`);
        setWalletModalVisible(false);
        setCurrentWallet({ id: '', name: '', address: '', balanceUSD: '0' });
      }
    };
    
    const handleBankAction = async () => {
      if (!bankAction.amount) {
        Alert.alert('Error', 'Please enter amount');
        return;
      }
  
      const amount = parseFloat(bankAction.amount) || 0;
      if (amount <= 0) {
        Alert.alert('Error', 'Amount must be greater than 0');
        return;
      }
  
      try {
        const currentBalance = parseFloat(currentBank.balance) || 0;
        
        const newBalance = bankAction.type === 'deposit' 
          ? currentBalance + amount
          : currentBalance - amount;
  
        // Check if withdrawal is possible
        if (bankAction.type === 'withdraw' && newBalance < 0) {
          Alert.alert('Error', 'Insufficient balance for withdrawal');
          return;
        }
  
        // Update UI immediately
        const updatedBanks = banks.map(b => 
          b.id === currentBank.id ? { 
            ...b, 
            balance: newBalance,
            updatedAt: getTodayDate()
          } : b
        );
        setBanks(updatedBanks);
        setFilteredBanks(updatedBanks);
        await AsyncStorage.setItem('banks', JSON.stringify(updatedBanks));
  
        // Update bank balance in Firestore
        await updateDoc(doc(db, 'banks', currentBank.id), {
          balance: newBalance,
          updatedAt: getTodayDate(),
        });
  
        // Save transaction to Firestore
        const transactionData = {
          bankId: currentBank.id,
          bankName: currentBank.name,
          type: bankAction.type,
          amount: amount,
          newBalance: newBalance,
          description: bankAction.description,
          date: getTodayDate(),
          timestamp: new Date().toISOString(),
          createdAt: getTodayDate(),
        };
  
        await addDoc(collection(db, `banks/${currentBank.id}/transactions`), transactionData);
  
        // Update currentBank for the modal
        setCurrentBank({...currentBank, balance: newBalance.toString()});
  
        Alert.alert('Success', `${bankAction.type === 'deposit' ? 'Deposit' : 'Withdrawal'} saved!`);
        setBankActionModalVisible(false);
        setBankAction({ type: 'deposit', amount: '', description: '', date: getTodayDate() });
      } catch (error) {
        console.error('Error saving bank action:', error);
        loadFromStorage();
        Alert.alert('Error', 'Failed to save transaction');
      }
    };
  
    const handleWalletAction = async () => {
      if (!walletAction.amountUSD) {
        Alert.alert('Error', 'Please enter amount in USD');
        return;
      }
  
      const amount = parseFloat(walletAction.amountUSD) || 0;
      if (amount <= 0) {
        Alert.alert('Error', 'Amount must be greater than 0');
        return;
      }
  
      try {
        const currentBalance = parseFloat(currentWallet.balanceUSD) || 0;
        
        const newBalance = walletAction.type === 'deposit' 
          ? currentBalance + amount
          : currentBalance - amount;
  
        // Check if withdrawal is possible
        if (walletAction.type === 'withdraw' && newBalance < 0) {
          Alert.alert('Error', 'Insufficient balance for withdrawal');
          return;
        }
  
        // Update UI immediately
        const updatedWallets = wallets.map(w => 
          w.id === currentWallet.id ? { 
            ...w, 
            balanceUSD: newBalance,
            updatedAt: getTodayDate()
          } : w
        );
        setWallets(updatedWallets);
        setFilteredWallets(updatedWallets);
        await AsyncStorage.setItem('wallets', JSON.stringify(updatedWallets));
  
        // Update wallet balance in Firestore
        await updateDoc(doc(db, 'wallets', currentWallet.id), {
          balanceUSD: newBalance,
          updatedAt: getTodayDate(),
        });
  
        // Save transaction to Firestore
        const transactionData = {
          walletId: currentWallet.id,
          walletName: currentWallet.name,
          type: walletAction.type,
          amountUSD: amount,
          newBalance: newBalance,
          description: walletAction.description,
          date: getTodayDate(),
          timestamp: new Date().toISOString(),
          createdAt: getTodayDate(),
        };
  
        await addDoc(collection(db, `wallets/${currentWallet.id}/transactions`), transactionData);
  
        // Update currentWallet for the modal
        setCurrentWallet({...currentWallet, balanceUSD: newBalance.toString()});
  
        Alert.alert('Success', `${walletAction.type === 'deposit' ? 'Deposit' : 'Withdrawal'} saved!`);
        setWalletActionModalVisible(false);
        setWalletAction({ type: 'deposit', amountUSD: '', description: '', date: getTodayDate() });
      } catch (error) {
        console.error('Error saving wallet action:', error);
        loadFromStorage();
        Alert.alert('Error', 'Failed to save transaction');
      }
    };
  
    const deleteBank = (bankId) => {
      Alert.alert(
        'Delete Bank',
        'Are you sure you want to delete this bank? All transactions will be lost.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                // Update UI immediately
                const updatedBanks = banks.filter(b => b.id !== bankId);
                setBanks(updatedBanks);
                setFilteredBanks(updatedBanks);
                await AsyncStorage.setItem('banks', JSON.stringify(updatedBanks));
                
                // Delete from Firestore
                await deleteDoc(doc(db, 'banks', bankId));
                
                // Delete associated transactions from AsyncStorage
                await AsyncStorage.removeItem(`bank_transactions_${bankId}`);
                
                Alert.alert('Success', 'Bank deleted from cloud!');
              } catch (error) {
                console.error('Error deleting bank:', error);
                // Revert if Firestore fails
                loadFromStorage();
                Alert.alert('Error', 'Failed to delete from cloud');
              }
            },
          },
        ]
      );
    };
  
    const deleteWallet = (walletId) => {
      Alert.alert(
        'Delete Wallet',
        'Are you sure you want to delete this wallet? All transactions will be lost.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                // Update UI immediately
                const updatedWallets = wallets.filter(w => w.id !== walletId);
                setWallets(updatedWallets);
                setFilteredWallets(updatedWallets);
                await AsyncStorage.setItem('wallets', JSON.stringify(updatedWallets));
                
                // Delete from Firestore
                await deleteDoc(doc(db, 'wallets', walletId));
                
                // Delete associated transactions from AsyncStorage
                await AsyncStorage.removeItem(`wallet_transactions_${walletId}`);
                
                Alert.alert('Success', 'Wallet deleted from cloud!');
              } catch (error) {
                console.error('Error deleting wallet:', error);
                // Revert if Firestore fails
                loadFromStorage();
                Alert.alert('Error', 'Failed to delete from cloud');
              }
            },
          },
        ]
      );
    };
  
    const openBankActionModal = (bank) => {
      setCurrentBank(bank);
      setBankAction({ type: 'deposit', amount: '', description: '', date: getTodayDate() });
      setBankActionModalVisible(true);
    };
  
    const openWalletActionModal = (wallet) => {
      setCurrentWallet(wallet);
      setWalletAction({ type: 'deposit', amountUSD: '', description: '', date: getTodayDate() });
      setWalletActionModalVisible(true);
    };
  
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.screenTitle}>🏦 Banks & Wallets</Text>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={onRefresh}
          >
            <Icon name="refresh" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>
  
        <ScrollView 
          style={styles.scrollContainer}
          showsVerticalScrollIndicator={true}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          {/* Banks Section */}
          <View style={styles.subSection}>
            <View style={styles.subSectionHeader}>
              <Text style={styles.subSectionTitle}>🏦 Banks (BDT)</Text>
              <View style={styles.subSectionActions}>
                <TouchableOpacity 
                  style={styles.smallAddButton}
                  onPress={() => {
                    setCurrentBank({ id: '', name: '', account: '', balance: '0' });
                    setBankModalVisible(true);
                  }}
                >
                  <Icon name="add" size={20} color="white" />
                </TouchableOpacity>
              </View>
            </View>
            
            {/* Bank Search */}
            <View style={styles.searchContainer}>
              <Icon name="search" size={16} color="#666" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search banks..."
                value={bankSearchQuery}
                onChangeText={setBankSearchQuery}
                clearButtonMode="while-editing"
              />
              {bankSearchQuery.length > 0 && (
                <TouchableOpacity 
                  style={styles.clearSearchButton}
                  onPress={() => setBankSearchQuery('')}
                >
                  <Icon name="close" size={16} color="#666" />
                </TouchableOpacity>
              )}
            </View>
            
            <Text style={styles.itemCount}>
              {filteredBanks.length} bank{filteredBanks.length !== 1 ? 's' : ''}
              {bankSearchQuery ? ` found for "${bankSearchQuery}"` : ''}
            </Text>
            
            {filteredBanks.map((bank, index) => (
              <TouchableOpacity 
                key={bank.id} 
                style={styles.listCard}
                onPress={() => navigation.navigate('BankWalletDetails', { 
                  item: bank, 
                  type: 'bank' 
                })}
                onLongPress={() => deleteBank(bank.id)}
              >
                <View style={styles.listCardHeader}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemIndex}>#{index + 1}</Text>
                    <View>
                      <Text style={styles.listCardTitle}>{bank.name}</Text>
                      {(bank.createdAt || bank.updatedAt) && (
                        <Text style={styles.itemDate}>
                          {bank.updatedAt ? `Updated: ${bank.updatedAt}` : `Added: ${bank.createdAt}`}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.listCardActions}>
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        setCurrentBank(bank);
                        setBankModalVisible(true);
                      }}
                    >
                      <Icon name="edit" size={18} color="#007AFF" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        deleteBank(bank.id);
                      }}
                    >
                      <Icon name="delete" size={18} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                </View>
                
                {bank.account ? (
                  <View style={styles.infoContainer}>
                    <Icon name="account-balance" size={14} color="#666" />
                    <Text style={styles.listCardText}> Account: {bank.account}</Text>
                  </View>
                ) : null}
                
                <View style={styles.balanceContainer}>
                  <Text style={[
                    styles.balanceText,
                    bank.balance >= 0 ? styles.positiveBalance : styles.negativeBalance
                  ]}>
                    Balance: {formatCurrency(bank.balance)}
                  </Text>
                  
                  <View style={styles.actionButtonsSmall}>
                    <TouchableOpacity 
                      style={[styles.smallActionButton, styles.depositButton]}
                      onPress={(e) => {
                        e.stopPropagation();
                        openBankActionModal(bank);
                      }}
                    >
                      <Icon name="add" size={16} color="white" />
                      <Text style={styles.smallActionButtonText}>+</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[styles.smallActionButton, styles.withdrawButton]}
                      onPress={(e) => {
                        e.stopPropagation();
                        setCurrentBank(bank);
                        setBankAction({ type: 'withdraw', amount: '', description: '', date: getTodayDate() });
                        setBankActionModalVisible(true);
                      }}
                    >
                      <Icon name="remove" size={16} color="white" />
                      <Text style={styles.smallActionButtonText}>-</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
            
            {filteredBanks.length === 0 && (
              <View style={styles.emptyState}>
                <Icon name="account-balance" size={48} color="#ccc" />
                <Text style={styles.emptyStateText}>
                  {bankSearchQuery ? 'No banks found' : 'No banks added yet'}
                </Text>
              </View>
            )}
          </View>
  
          {/* Wallets Section */}
          <View style={styles.subSection}>
            <View style={styles.subSectionHeader}>
              <Text style={styles.subSectionTitle}>💳 USDT Wallets</Text>
              <View style={styles.subSectionActions}>
                <TouchableOpacity 
                  style={styles.smallAddButton}
                  onPress={() => {
                    setCurrentWallet({ id: '', name: '', address: '', balanceUSD: '0' });
                    setWalletModalVisible(true);
                  }}
                >
                  <Icon name="add" size={20} color="white" />
                </TouchableOpacity>
              </View>
            </View>
            
            {/* Wallet Search */}
            <View style={styles.searchContainer}>
              <Icon name="search" size={16} color="#666" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search wallets..."
                value={walletSearchQuery}
                onChangeText={setWalletSearchQuery}
                clearButtonMode="while-editing"
              />
              {walletSearchQuery.length > 0 && (
                <TouchableOpacity 
                  style={styles.clearSearchButton}
                  onPress={() => setWalletSearchQuery('')}
                >
                  <Icon name="close" size={16} color="#666" />
                </TouchableOpacity>
              )}
            </View>
            
            <Text style={styles.itemCount}>
              {filteredWallets.length} wallet{filteredWallets.length !== 1 ? 's' : ''}
              {walletSearchQuery ? ` found for "${walletSearchQuery}"` : ''}
            </Text>
            
            {filteredWallets.map((wallet, index) => (
              <TouchableOpacity 
                key={wallet.id} 
                style={styles.listCard}
                onPress={() => navigation.navigate('BankWalletDetails', { 
                  item: wallet, 
                  type: 'wallet' 
                })}
                onLongPress={() => deleteWallet(wallet.id)}
              >
                <View style={styles.listCardHeader}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemIndex}>#{index + 1}</Text>
                    <View>
                      <Text style={styles.listCardTitle}>{wallet.name}</Text>
                      {(wallet.createdAt || wallet.updatedAt) && (
                        <Text style={styles.itemDate}>
                          {wallet.updatedAt ? `Updated: ${wallet.updatedAt}` : `Added: ${wallet.createdAt}`}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.listCardActions}>
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        setCurrentWallet(wallet);
                        setWalletModalVisible(true);
                      }}
                    >
                      <Icon name="edit" size={18} color="#007AFF" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        deleteWallet(wallet.id);
                      }}
                    >
                      <Icon name="delete" size={18} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                </View>
                
                {wallet.address ? (
                  <View style={styles.infoContainer}>
                    <Icon name="account-balance-wallet" size={14} color="#666" />
                    <Text style={styles.listCardText}> Address: {wallet.address}</Text>
                  </View>
                ) : null}
                
                <View style={styles.balanceContainer}>
                  <Text style={[
                    styles.balanceText,
                    wallet.balanceUSD >= 0 ? styles.positiveBalance : styles.negativeBalance
                  ]}>
                    Balance: {formatUSD(wallet.balanceUSD)}
                  </Text>
                  
                  <View style={styles.actionButtonsSmall}>
                    <TouchableOpacity 
                      style={[styles.smallActionButton, styles.depositButton]}
                      onPress={(e) => {
                        e.stopPropagation();
                        openWalletActionModal(wallet);
                      }}
                    >
                      <Icon name="add" size={16} color="white" />
                      <Text style={styles.smallActionButtonText}>+</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[styles.smallActionButton, styles.withdrawButton]}
                      onPress={(e) => {
                        e.stopPropagation();
                        setCurrentWallet(wallet);
                        setWalletAction({ type: 'withdraw', amountUSD: '', description: '', date: getTodayDate() });
                        setWalletActionModalVisible(true);
                      }}
                    >
                      <Icon name="remove" size={16} color="white" />
                      <Text style={styles.smallActionButtonText}>-</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
            
            {filteredWallets.length === 0 && (
              <View style={styles.emptyState}>
                <Icon name="account-balance-wallet" size={48} color="#ccc" />
                <Text style={styles.emptyStateText}>
                  {walletSearchQuery ? 'No wallets found' : 'No wallets added yet'}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
        
        {/* Bank Add/Edit Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={bankModalVisible}
          onRequestClose={() => setBankModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {currentBank.id ? 'Edit Bank' : 'Add New Bank'}
              </Text>
              
              <TextInput
                style={styles.input}
                placeholder="Bank Name *"
                value={currentBank.name}
                onChangeText={(text) => setCurrentBank({...currentBank, name: text})}
              />
              
              <TextInput
                style={styles.input}
                placeholder="Account Number (Optional)"
                value={currentBank.account}
                onChangeText={(text) => setCurrentBank({...currentBank, account: text})}
              />
              
              <TextInput
                style={styles.input}
                placeholder="Initial Balance (BDT)"
                value={currentBank.balance}
                onChangeText={(text) => setCurrentBank({...currentBank, balance: text})}
                keyboardType="numeric"
              />
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setBankModalVisible(false)}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={saveBank}
                >
                  <Text style={styles.modalButtonText}>
                    {currentBank.id ? 'Update' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
  
        {/* Wallet Add/Edit Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={walletModalVisible}
          onRequestClose={() => setWalletModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {currentWallet.id ? 'Edit Wallet' : 'Add New Wallet'}
              </Text>
              
              <TextInput
                style={styles.input}
                placeholder="Wallet Name *"
                value={currentWallet.name}
                onChangeText={(text) => setCurrentWallet({...currentWallet, name: text})}
              />
              
              <TextInput
                style={styles.input}
                placeholder="Address (Optional)"
                value={currentWallet.address}
                onChangeText={(text) => setCurrentWallet({...currentWallet, address: text})}
              />
              
              <TextInput
                style={styles.input}
                placeholder="Initial Balance ($)"
                value={currentWallet.balanceUSD}
                onChangeText={(text) => setCurrentWallet({...currentWallet, balanceUSD: text})}
                keyboardType="numeric"
              />
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setWalletModalVisible(false)}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={saveWallet}
                >
                  <Text style={styles.modalButtonText}>
                    {currentWallet.id ? 'Update' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
  
        {/* Bank Action Modal (Deposit/Withdraw) */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={bankActionModalVisible}
          onRequestClose={() => setBankActionModalVisible(false)}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {bankAction.type === 'deposit' ? '💵 Deposit to Bank' : '💰 Withdraw from Bank'}
              </Text>
              
              <Text style={styles.currentBalance}>
                Bank: {currentBank.name}
              </Text>
              <Text style={styles.currentBalance}>
                Current Balance: {formatCurrency(currentBank.balance)}
              </Text>
              
              <View style={styles.radioGroup}>
                <TouchableOpacity
                  style={[
                    styles.radioButton,
                    bankAction.type === 'deposit' && styles.radioButtonSelected
                  ]}
                  onPress={() => setBankAction({...bankAction, type: 'deposit'})}
                >
                  <Text style={bankAction.type === 'deposit' ? styles.radioButtonTextSelected : styles.radioButtonText}>
                    Deposit (+)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.radioButton,
                    bankAction.type === 'withdraw' && styles.radioButtonSelected
                  ]}
                  onPress={() => setBankAction({...bankAction, type: 'withdraw'})}
                >
                  <Text style={bankAction.type === 'withdraw' ? styles.radioButtonTextSelected : styles.radioButtonText}>
                    Withdraw (-)
                  </Text>
                </TouchableOpacity>
              </View>
              
              <TextInput
                style={styles.input}
                placeholder="Amount (BDT)"
                value={bankAction.amount}
                onChangeText={(text) => setBankAction({...bankAction, amount: text})}
                keyboardType="numeric"
              />
              
              {bankAction.amount && (
                <View style={styles.calculationBox}>
                  <Text style={styles.calculationText}>
                    Current: {formatCurrency(parseFloat(currentBank.balance) || 0)}
                  </Text>
                  <Text style={styles.calculationText}>
                    {bankAction.type === 'deposit' ? '+' : '-'} {formatCurrency(parseFloat(bankAction.amount) || 0)}
                  </Text>
                  <Text style={[styles.calculationText, styles.boldText]}>
                    New Balance: {formatCurrency(
                      bankAction.type === 'deposit' 
                        ? (parseFloat(currentBank.balance) || 0) + (parseFloat(bankAction.amount) || 0)
                        : (parseFloat(currentBank.balance) || 0) - (parseFloat(bankAction.amount) || 0)
                    )}
                  </Text>
                </View>
              )}
              
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Description (Optional)"
                value={bankAction.description}
                onChangeText={(text) => setBankAction({...bankAction, description: text})}
                multiline
                numberOfLines={3}
              />
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setBankActionModalVisible(false)}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleBankAction}
                >
                  <Text style={styles.modalButtonText}>
                    {bankAction.type === 'deposit' ? 'Deposit' : 'Withdraw'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
  
        {/* Wallet Action Modal (Deposit/Withdraw) */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={walletActionModalVisible}
          onRequestClose={() => setWalletActionModalVisible(false)}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {walletAction.type === 'deposit' ? '💵 Deposit to Wallet' : '💰 Withdraw from Wallet'}
              </Text>
              
              <Text style={styles.currentBalance}>
                Wallet: {currentWallet.name}
              </Text>
              <Text style={styles.currentBalance}>
                Current Balance: {formatUSD(currentWallet.balanceUSD)}
              </Text>
              
              <View style={styles.radioGroup}>
                <TouchableOpacity
                  style={[
                    styles.radioButton,
                    walletAction.type === 'deposit' && styles.radioButtonSelected
                  ]}
                  onPress={() => setWalletAction({...walletAction, type: 'deposit'})}
                >
                  <Text style={walletAction.type === 'deposit' ? styles.radioButtonTextSelected : styles.radioButtonText}>
                    Deposit (+)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.radioButton,
                    walletAction.type === 'withdraw' && styles.radioButtonSelected
                  ]}
                  onPress={() => setWalletAction({...walletAction, type: 'withdraw'})}
                >
                  <Text style={walletAction.type === 'withdraw' ? styles.radioButtonTextSelected : styles.radioButtonText}>
                    Withdraw (-)
                  </Text>
                </TouchableOpacity>
              </View>
              
              <TextInput
                style={styles.input}
                placeholder="Amount (USD)"
                value={walletAction.amountUSD}
                onChangeText={(text) => setWalletAction({...walletAction, amountUSD: text})}
                keyboardType="numeric"
              />
              
              {walletAction.amountUSD && (
                <View style={styles.calculationBox}>
                  <Text style={styles.calculationText}>
                    Current: {formatUSD(parseFloat(currentWallet.balanceUSD) || 0)}
                  </Text>
                  <Text style={styles.calculationText}>
                    {walletAction.type === 'deposit' ? '+' : '-'} {formatUSD(parseFloat(walletAction.amountUSD) || 0)}
                  </Text>
                  <Text style={[styles.calculationText, styles.boldText]}>
                    New Balance: {formatUSD(
                      walletAction.type === 'deposit' 
                        ? (parseFloat(currentWallet.balanceUSD) || 0) + (parseFloat(walletAction.amountUSD) || 0)
                        : (parseFloat(currentWallet.balanceUSD) || 0) - (parseFloat(walletAction.amountUSD) || 0)
                    )}
                  </Text>
                </View>
              )}
              
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Description (Optional)"
                value={walletAction.description}
                onChangeText={(text) => setWalletAction({...walletAction, description: text})}
                multiline
                numberOfLines={3}
              />
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setWalletActionModalVisible(false)}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleWalletAction}
                >
                  <Text style={styles.modalButtonText}>
                    {walletAction.type === 'deposit' ? 'Deposit' : 'Withdraw'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
        
      </View>
    );
}
