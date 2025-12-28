import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  RefreshControl,
} from 'react-native';

import { MaterialCommunityIcons as Icon } from '@expo/vector-icons'; // ✅ same as Dashboard
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
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

  const sortByUpdated = useCallback((list) => {
    const arr = [...(list || [])];
    arr.sort((a, b) => {
      const dateA = a.updatedAt ? new Date(a.updatedAt) : new Date(a.createdAt || 0);
      const dateB = b.updatedAt ? new Date(b.updatedAt) : new Date(b.createdAt || 0);
      return dateB - dateA;
    });
    return arr;
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (bankSearchQuery.trim() === '') {
      setFilteredBanks(banks);
    } else {
      const filtered = banks.filter(
        (bank) =>
          (bank.name || '').toLowerCase().includes(bankSearchQuery.toLowerCase()) ||
          (bank.account && bank.account.includes(bankSearchQuery))
      );
      setFilteredBanks(filtered);
    }
  }, [bankSearchQuery, banks]);

  useEffect(() => {
    if (walletSearchQuery.trim() === '') {
      setFilteredWallets(wallets);
    } else {
      const filtered = wallets.filter(
        (wallet) =>
          (wallet.name || '').toLowerCase().includes(walletSearchQuery.toLowerCase()) ||
          (wallet.address && wallet.address.includes(walletSearchQuery))
      );
      setFilteredWallets(filtered);
    }
  }, [walletSearchQuery, wallets]);

  const loadFromStorage = async () => {
    try {
      const storedBanks = await AsyncStorage.getItem('banks');
      const storedWallets = await AsyncStorage.getItem('wallets');

      if (storedBanks) {
        const list = sortByUpdated(JSON.parse(storedBanks));
        setBanks(list);
        setFilteredBanks(list);
      }
      if (storedWallets) {
        const list = sortByUpdated(JSON.parse(storedWallets));
        setWallets(list);
        setFilteredWallets(list);
      }
    } catch (error) {
      console.error('Error loading from storage:', error);
    }
  };

  const loadData = async () => {
    try {
      const banksSnapshot = await getDocs(collection(db, 'banks'));
      const banksList = sortByUpdated(banksSnapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      setBanks(banksList);
      setFilteredBanks(banksList);
      await AsyncStorage.setItem('banks', JSON.stringify(banksList));

      const walletsSnapshot = await getDocs(collection(db, 'wallets'));
      const walletsList = sortByUpdated(walletsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      setWallets(walletsList);
      setFilteredWallets(walletsList);
      await AsyncStorage.setItem('wallets', JSON.stringify(walletsList));
    } catch (error) {
      console.error('Error loading data:', error);
      loadFromStorage();
    }
  };

  // ✅ Pull-to-refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }, []);

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

      let updatedBanks;
      if (currentBank.id) {
        updatedBanks = banks.map((b) => (b.id === currentBank.id ? { ...b, ...bankData } : b));
      } else {
        const tempId = `temp_bank_${Date.now()}`;
        updatedBanks = [{ ...bankData, id: tempId, createdAt: getTodayDate() }, ...banks];
      }

      updatedBanks = sortByUpdated(updatedBanks);
      setBanks(updatedBanks);
      setFilteredBanks(updatedBanks);
      await AsyncStorage.setItem('banks', JSON.stringify(updatedBanks));

      if (!currentBank.id) bankData.createdAt = getTodayDate();

      if (currentBank.id) {
        const updateData = { ...bankData };
        delete updateData.createdAt;
        await updateDoc(doc(db, 'banks', currentBank.id), updateData);
        Alert.alert('Success', 'Bank updated!');
      } else {
        const docRef = await addDoc(collection(db, 'banks'), bankData);
        const realBank = { id: docRef.id, ...bankData };
        const finalBanks = updatedBanks.map((b) => (String(b.id).startsWith('temp_bank_') ? realBank : b));
        setBanks(finalBanks);
        setFilteredBanks(finalBanks);
        await AsyncStorage.setItem('banks', JSON.stringify(finalBanks));
        Alert.alert('Success', 'Bank added!');
      }

      setBankModalVisible(false);
      setCurrentBank({ id: '', name: '', account: '', balance: '0' });
    } catch (error) {
      console.error('Error saving bank:', error);
      loadFromStorage();
      Alert.alert('Error', 'Failed to save bank');
      setBankModalVisible(false);
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

      let updatedWallets;
      if (currentWallet.id) {
        updatedWallets = wallets.map((w) => (w.id === currentWallet.id ? { ...w, ...walletData } : w));
      } else {
        const tempId = `temp_wallet_${Date.now()}`;
        updatedWallets = [{ ...walletData, id: tempId, createdAt: getTodayDate() }, ...wallets];
      }

      updatedWallets = sortByUpdated(updatedWallets);
      setWallets(updatedWallets);
      setFilteredWallets(updatedWallets);
      await AsyncStorage.setItem('wallets', JSON.stringify(updatedWallets));

      if (!currentWallet.id) walletData.createdAt = getTodayDate();

      if (currentWallet.id) {
        const updateData = { ...walletData };
        delete updateData.createdAt;
        await updateDoc(doc(db, 'wallets', currentWallet.id), updateData);
        Alert.alert('Success', 'Wallet updated!');
      } else {
        const docRef = await addDoc(collection(db, 'wallets'), walletData);
        const realWallet = { id: docRef.id, ...walletData };
        const finalWallets = updatedWallets.map((w) => (String(w.id).startsWith('temp_wallet_') ? realWallet : w));
        setWallets(finalWallets);
        setFilteredWallets(finalWallets);
        await AsyncStorage.setItem('wallets', JSON.stringify(finalWallets));
        Alert.alert('Success', 'Wallet added!');
      }

      setWalletModalVisible(false);
      setCurrentWallet({ id: '', name: '', address: '', balanceUSD: '0' });
    } catch (error) {
      console.error('Error saving wallet:', error);
      loadFromStorage();
      Alert.alert('Error', 'Failed to save wallet');
      setWalletModalVisible(false);
    }
  };

  const deleteBank = (bankId) => {
    Alert.alert('Delete Bank', 'Are you sure you want to delete this bank? All transactions will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const updated = banks.filter((b) => b.id !== bankId);
            setBanks(updated);
            setFilteredBanks(updated);
            await AsyncStorage.setItem('banks', JSON.stringify(updated));
            await deleteDoc(doc(db, 'banks', bankId));
            await AsyncStorage.removeItem(`bank_transactions_${bankId}`);
            Alert.alert('Success', 'Bank deleted!');
          } catch (error) {
            console.error('Error deleting bank:', error);
            loadFromStorage();
            Alert.alert('Error', 'Failed to delete from cloud');
          }
        },
      },
    ]);
  };

  const deleteWallet = (walletId) => {
    Alert.alert('Delete Wallet', 'Are you sure you want to delete this wallet? All transactions will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const updated = wallets.filter((w) => w.id !== walletId);
            setWallets(updated);
            setFilteredWallets(updated);
            await AsyncStorage.setItem('wallets', JSON.stringify(updated));
            await deleteDoc(doc(db, 'wallets', walletId));
            await AsyncStorage.removeItem(`wallet_transactions_${walletId}`);
            Alert.alert('Success', 'Wallet deleted!');
          } catch (error) {
            console.error('Error deleting wallet:', error);
            loadFromStorage();
            Alert.alert('Error', 'Failed to delete from cloud');
          }
        },
      },
    ]);
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

  const handleBankAction = async () => {
    if (!bankAction.amount) return Alert.alert('Error', 'Please enter amount');
    const amount = parseFloat(bankAction.amount) || 0;
    if (amount <= 0) return Alert.alert('Error', 'Amount must be greater than 0');

    try {
      const currentBalance = parseFloat(currentBank.balance) || 0;
      const newBalance = bankAction.type === 'deposit' ? currentBalance + amount : currentBalance - amount;
      if (bankAction.type === 'withdraw' && newBalance < 0) return Alert.alert('Error', 'Insufficient balance');

      const updatedBanks = banks.map((b) =>
        b.id === currentBank.id ? { ...b, balance: newBalance, updatedAt: getTodayDate() } : b
      );
      setBanks(updatedBanks);
      setFilteredBanks(updatedBanks);
      await AsyncStorage.setItem('banks', JSON.stringify(updatedBanks));

      await updateDoc(doc(db, 'banks', currentBank.id), { balance: newBalance, updatedAt: getTodayDate() });

      await addDoc(collection(db, `banks/${currentBank.id}/transactions`), {
        bankId: currentBank.id,
        bankName: currentBank.name,
        type: bankAction.type,
        amount,
        newBalance,
        description: bankAction.description,
        date: getTodayDate(),
        timestamp: new Date().toISOString(),
        createdAt: getTodayDate(),
      });

      setCurrentBank({ ...currentBank, balance: String(newBalance) });
      setBankActionModalVisible(false);
      setBankAction({ type: 'deposit', amount: '', description: '', date: getTodayDate() });
      Alert.alert('Success', 'Transaction saved!');
    } catch (error) {
      console.error('Error saving bank action:', error);
      loadFromStorage();
      Alert.alert('Error', 'Failed to save transaction');
    }
  };

  const handleWalletAction = async () => {
    if (!walletAction.amountUSD) return Alert.alert('Error', 'Please enter amount in USD');
    const amount = parseFloat(walletAction.amountUSD) || 0;
    if (amount <= 0) return Alert.alert('Error', 'Amount must be greater than 0');

    try {
      const currentBalance = parseFloat(currentWallet.balanceUSD) || 0;
      const newBalance = walletAction.type === 'deposit' ? currentBalance + amount : currentBalance - amount;
      if (walletAction.type === 'withdraw' && newBalance < 0) return Alert.alert('Error', 'Insufficient balance');

      const updatedWallets = wallets.map((w) =>
        w.id === currentWallet.id ? { ...w, balanceUSD: newBalance, updatedAt: getTodayDate() } : w
      );
      setWallets(updatedWallets);
      setFilteredWallets(updatedWallets);
      await AsyncStorage.setItem('wallets', JSON.stringify(updatedWallets));

      await updateDoc(doc(db, 'wallets', currentWallet.id), { balanceUSD: newBalance, updatedAt: getTodayDate() });

      await addDoc(collection(db, `wallets/${currentWallet.id}/transactions`), {
        walletId: currentWallet.id,
        walletName: currentWallet.name,
        type: walletAction.type,
        amountUSD: amount,
        newBalance,
        description: walletAction.description,
        date: getTodayDate(),
        timestamp: new Date().toISOString(),
        createdAt: getTodayDate(),
      });

      setCurrentWallet({ ...currentWallet, balanceUSD: String(newBalance) });
      setWalletActionModalVisible(false);
      setWalletAction({ type: 'deposit', amountUSD: '', description: '', date: getTodayDate() });
      Alert.alert('Success', 'Transaction saved!');
    } catch (error) {
      console.error('Error saving wallet action:', error);
      loadFromStorage();
      Alert.alert('Error', 'Failed to save transaction');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>🏦 Banks & Wallets</Text>
      </View>

      {/* ✅ Pull-to-refresh on ScrollView (correct way) */}
      <ScrollView
        style={styles.scrollContainer}
        showsVerticalScrollIndicator
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Banks Section */}
        <View style={styles.subSection}>
          <View style={styles.subSectionHeader}>
            <View style={styles.subSectionActions}>
              <TouchableOpacity
                style={styles.smallAddButton}
                onPress={() => {
                  setCurrentBank({ id: '', name: '', account: '', balance: '0' });
                  setBankModalVisible(true);
                }}
              >
                <Icon name="plus" size={20} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.searchContainer}>
            <Icon name="magnify" size={16} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search banks..."
              value={bankSearchQuery}
              onChangeText={setBankSearchQuery}
              clearButtonMode="while-editing"
            />
            {bankSearchQuery.length > 0 && (
              <TouchableOpacity style={styles.clearSearchButton} onPress={() => setBankSearchQuery('')}>
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
              onPress={() => navigation.navigate('BankWalletDetails', { item: bank, type: 'bank' })}
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
                    <Icon name="pencil" size={18} color="#007AFF" />
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
                  <Icon name="bank" size={14} color="#666" />
                  <Text style={styles.listCardText}> Account: {bank.account}</Text>
                </View>
              ) : null}

              <View style={styles.balanceContainer}>
                <Text
                  style={[
                    styles.balanceText,
                    bank.balance >= 0 ? styles.positiveBalance : styles.negativeBalance,
                  ]}
                >
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
                    <Icon name="plus" size={16} color="white" />
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
                    <Icon name="minus" size={16} color="white" />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          ))}

          {filteredBanks.length === 0 && (
            <View style={styles.emptyState}>
              <Icon name="bank" size={48} color="#ccc" />
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
                <Icon name="plus" size={20} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.searchContainer}>
            <Icon name="magnify" size={16} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search wallets..."
              value={walletSearchQuery}
              onChangeText={setWalletSearchQuery}
              clearButtonMode="while-editing"
            />
            {walletSearchQuery.length > 0 && (
              <TouchableOpacity style={styles.clearSearchButton} onPress={() => setWalletSearchQuery('')}>
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
              onPress={() => navigation.navigate('BankWalletDetails', { item: wallet, type: 'wallet' })}
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
                    <Icon name="pencil" size={18} color="#007AFF" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      deleteWallet(wallet.id);
                    }}
                  >
                    <Icon name="trash-can-outline" size={18} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              </View>

              {wallet.address ? (
                <View style={styles.infoContainer}>
                  <Icon name="wallet" size={14} color="#666" />
                  <Text style={styles.listCardText}> Address: {wallet.address}</Text>
                </View>
              ) : null}

              <View style={styles.balanceContainer}>
                <Text
                  style={[
                    styles.balanceText,
                    wallet.balanceUSD >= 0 ? styles.positiveBalance : styles.negativeBalance,
                  ]}
                >
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
                    <Icon name="plus" size={16} color="white" />
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
                    <Icon name="minus" size={16} color="white" />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          ))}

          {filteredWallets.length === 0 && (
            <View style={styles.emptyState}>
              <Icon name="wallet" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>
                {walletSearchQuery ? 'No wallets found' : 'No wallets added yet'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bank Add/Edit Modal */}
      <Modal animationType="slide" transparent visible={bankModalVisible} onRequestClose={() => setBankModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{currentBank.id ? 'Edit Bank' : 'Add New Bank'}</Text>

            <TextInput style={styles.input} placeholder="Bank Name *" value={currentBank.name} onChangeText={(t) => setCurrentBank({ ...currentBank, name: t })} />
            <TextInput style={styles.input} placeholder="Account Number (Optional)" value={currentBank.account} onChangeText={(t) => setCurrentBank({ ...currentBank, account: t })} />
            <TextInput style={styles.input} placeholder="Initial Balance (BDT)" value={currentBank.balance} onChangeText={(t) => setCurrentBank({ ...currentBank, balance: t })} keyboardType="numeric" />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setBankModalVisible(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={saveBank}>
                <Text style={styles.modalButtonText}>{currentBank.id ? 'Update' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Wallet Add/Edit Modal */}
      <Modal animationType="slide" transparent visible={walletModalVisible} onRequestClose={() => setWalletModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{currentWallet.id ? 'Edit Wallet' : 'Add New Wallet'}</Text>

            <TextInput style={styles.input} placeholder="Wallet Name *" value={currentWallet.name} onChangeText={(t) => setCurrentWallet({ ...currentWallet, name: t })} />
            <TextInput style={styles.input} placeholder="Address (Optional)" value={currentWallet.address} onChangeText={(t) => setCurrentWallet({ ...currentWallet, address: t })} />
            <TextInput style={styles.input} placeholder="Initial Balance ($)" value={currentWallet.balanceUSD} onChangeText={(t) => setCurrentWallet({ ...currentWallet, balanceUSD: t })} keyboardType="numeric" />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setWalletModalVisible(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={saveWallet}>
                <Text style={styles.modalButtonText}>{currentWallet.id ? 'Update' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bank Action Modal */}
      <Modal animationType="slide" transparent visible={bankActionModalVisible} onRequestClose={() => setBankActionModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {bankAction.type === 'deposit' ? '💵 Deposit to Bank' : '💰 Withdraw from Bank'}
            </Text>

            <Text style={styles.currentBalance}>Bank: {currentBank.name}</Text>
            <Text style={styles.currentBalance}>Current Balance: {formatCurrency(currentBank.balance)}</Text>

            <View style={styles.radioGroup}>
              <TouchableOpacity style={[styles.radioButton, bankAction.type === 'deposit' && styles.radioButtonSelected]} onPress={() => setBankAction({ ...bankAction, type: 'deposit' })}>
                <Text style={bankAction.type === 'deposit' ? styles.radioButtonTextSelected : styles.radioButtonText}>Deposit (+)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.radioButton, bankAction.type === 'withdraw' && styles.radioButtonSelected]} onPress={() => setBankAction({ ...bankAction, type: 'withdraw' })}>
                <Text style={bankAction.type === 'withdraw' ? styles.radioButtonTextSelected : styles.radioButtonText}>Withdraw (-)</Text>
              </TouchableOpacity>
            </View>

            <TextInput style={styles.input} placeholder="Amount (BDT)" value={bankAction.amount} onChangeText={(t) => setBankAction({ ...bankAction, amount: t })} keyboardType="numeric" />
            <TextInput style={[styles.input, styles.textArea]} placeholder="Description (Optional)" value={bankAction.description} onChangeText={(t) => setBankAction({ ...bankAction, description: t })} multiline numberOfLines={3} />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setBankActionModalVisible(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleBankAction}>
                <Text style={styles.modalButtonText}>{bankAction.type === 'deposit' ? 'Deposit' : 'Withdraw'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Wallet Action Modal */}
      <Modal animationType="slide" transparent visible={walletActionModalVisible} onRequestClose={() => setWalletActionModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {walletAction.type === 'deposit' ? '💵 Deposit to Wallet' : '💰 Withdraw from Wallet'}
            </Text>

            <Text style={styles.currentBalance}>Wallet: {currentWallet.name}</Text>
            <Text style={styles.currentBalance}>Current Balance: {formatUSD(currentWallet.balanceUSD)}</Text>

            <View style={styles.radioGroup}>
              <TouchableOpacity style={[styles.radioButton, walletAction.type === 'deposit' && styles.radioButtonSelected]} onPress={() => setWalletAction({ ...walletAction, type: 'deposit' })}>
                <Text style={walletAction.type === 'deposit' ? styles.radioButtonTextSelected : styles.radioButtonText}>Deposit (+)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.radioButton, walletAction.type === 'withdraw' && styles.radioButtonSelected]} onPress={() => setWalletAction({ ...walletAction, type: 'withdraw' })}>
                <Text style={walletAction.type === 'withdraw' ? styles.radioButtonTextSelected : styles.radioButtonText}>Withdraw (-)</Text>
              </TouchableOpacity>
            </View>

            <TextInput style={styles.input} placeholder="Amount (USD)" value={walletAction.amountUSD} onChangeText={(t) => setWalletAction({ ...walletAction, amountUSD: t })} keyboardType="numeric" />
            <TextInput style={[styles.input, styles.textArea]} placeholder="Description (Optional)" value={walletAction.description} onChangeText={(t) => setWalletAction({ ...walletAction, description: t })} multiline numberOfLines={3} />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setWalletActionModalVisible(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleWalletAction}>
                <Text style={styles.modalButtonText}>{walletAction.type === 'deposit' ? 'Deposit' : 'Withdraw'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
