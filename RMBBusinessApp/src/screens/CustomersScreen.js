// src/screens/CustomersScreen.js
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  Alert,
  RefreshControl,
} from 'react-native';

import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  getDocs,
} from 'firebase/firestore';

import { db } from '../config/firebase';
import styles from '../styles/styles';
import { formatCurrency } from '../utils/format';
import { getTodayDate } from '../utils/date';

export default function CustomersScreen({ navigation }) {
  const [customers, setCustomers] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [currentCustomer, setCurrentCustomer] = useState({
    id: '',
    name: '',
    phone: '',
    balance: '0',
  });

  // -------- Helpers --------
  const sortCustomers = useCallback((list) => {
    const arr = [...(list || [])];
    arr.sort((a, b) => {
      const dateA = a.updatedAt ? new Date(a.updatedAt) : new Date(a.createdAt || 0);
      const dateB = b.updatedAt ? new Date(b.updatedAt) : new Date(b.createdAt || 0);
      return dateB - dateA;
    });
    return arr;
  }, []);

  const loadCustomersFromStorage = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem('customers');
      if (stored) {
        const list = sortCustomers(JSON.parse(stored));
        setCustomers(list);
      }
    } catch (error) {
      console.error('Error loading customers from storage:', error);
    }
  }, [sortCustomers]);

  // ✅ Manual fetch (used for pull-to-refresh)
  const fetchCustomersOnce = useCallback(async () => {
    const snap = await getDocs(collection(db, 'customers'));
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const sorted = sortCustomers(list);
    setCustomers(sorted);
    await AsyncStorage.setItem('customers', JSON.stringify(sorted));
  }, [sortCustomers]);

  // -------- Firestore realtime + fallback --------
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'customers'),
      async (snapshot) => {
        const list = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() });
        });
        const sorted = sortCustomers(list);
        setCustomers(sorted);
        // offline backup
        AsyncStorage.setItem('customers', JSON.stringify(sorted));
      },
      async (error) => {
        console.error('Firestore error:', error);
        await loadCustomersFromStorage();
      }
    );

    return () => unsubscribe();
  }, [loadCustomersFromStorage, sortCustomers]);

  // -------- Pull-to-refresh --------
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchCustomersOnce();
    } catch (e) {
      console.error('Refresh failed:', e);
      await loadCustomersFromStorage();
      Alert.alert('Offline', 'Loaded customers from device storage.');
    } finally {
      setRefreshing(false);
    }
  }, [fetchCustomersOnce, loadCustomersFromStorage]);

  // -------- Filter (derived) --------
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return customers;

    return customers.filter((customer) => {
      const nameMatch = (customer.name || '').toLowerCase().includes(q);
      const phoneMatch = (customer.phone || '').includes(searchQuery.trim());
      return nameMatch || phoneMatch;
    });
  }, [customers, searchQuery]);

  // -------- Save Customer --------
  const saveCustomer = async () => {
    if (!currentCustomer.name.trim()) {
      Alert.alert('Error', 'Customer name is required');
      return;
    }

    try {
      const balanceValue = parseFloat(currentCustomer.balance) || 0;

      const customerData = {
        name: currentCustomer.name.trim(),
        phone: currentCustomer.phone?.trim() || '',
        balance: balanceValue,
        updatedAt: getTodayDate(),
      };

      if (!currentCustomer.id) {
        customerData.createdAt = getTodayDate();
      }

      // ✅ Update UI immediately
      let updatedCustomers;
      if (currentCustomer.id) {
        updatedCustomers = customers.map(c =>
          c.id === currentCustomer.id ? { ...c, ...customerData, id: currentCustomer.id } : c
        );
      } else {
        const tempId = `temp_${Date.now()}`;
        updatedCustomers = [{ ...customerData, id: tempId }, ...customers];
      }

      updatedCustomers = sortCustomers(updatedCustomers);
      setCustomers(updatedCustomers);
      await AsyncStorage.setItem('customers', JSON.stringify(updatedCustomers));

      // ✅ Save to Firestore
      if (currentCustomer.id) {
        const updateData = { ...customerData };
        delete updateData.createdAt;
        await updateDoc(doc(db, 'customers', currentCustomer.id), updateData);
        Alert.alert('Success', 'Customer updated!');
      } else {
        const docRef = await addDoc(collection(db, 'customers'), customerData);
        const realCustomer = { id: docRef.id, ...customerData };

        // Replace temp item only (the one we just added)
        const finalList = updatedCustomers.map(c =>
          typeof c.id === 'string' && c.id.startsWith('temp_') ? realCustomer : c
        );

        const sortedFinal = sortCustomers(finalList);
        setCustomers(sortedFinal);
        await AsyncStorage.setItem('customers', JSON.stringify(sortedFinal));

        Alert.alert('Success', 'Customer added!');
      }

      setModalVisible(false);
      setCurrentCustomer({ id: '', name: '', phone: '', balance: '0' });
    } catch (error) {
      console.error('Error saving customer:', error);
      // Keep local changes, but tell user
      Alert.alert('Saved locally', 'Could not sync to cloud. Saved to device storage.');
      setModalVisible(false);
      setCurrentCustomer({ id: '', name: '', phone: '', balance: '0' });
    }
  };

  // -------- Delete Customer --------
  const deleteCustomer = (customerId) => {
    Alert.alert(
      'Delete Customer',
      'Are you sure you want to delete this customer? All transactions will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'customers', customerId));

              const updated = customers.filter(c => c.id !== customerId);
              setCustomers(updated);
              await AsyncStorage.setItem('customers', JSON.stringify(updated));
              await AsyncStorage.removeItem(`transactions_${customerId}`);

              Alert.alert('Success', 'Customer deleted!');
            } catch (error) {
              console.error('Error deleting customer:', error);

              // fallback local delete
              const updated = customers.filter(c => c.id !== customerId);
              setCustomers(updated);
              await AsyncStorage.setItem('customers', JSON.stringify(updated));
              await AsyncStorage.removeItem(`transactions_${customerId}`);

              Alert.alert('Deleted locally', 'Could not sync delete to cloud.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>👥 Customer Management</Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {/* Optional: keep refresh icon too (same vibe as CustomerDetails) */}
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={onRefresh}
            disabled={refreshing}
          >
            <Icon name="refresh" size={20} color="#007AFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              setCurrentCustomer({ id: '', name: '', phone: '', balance: '0' });
              setModalVisible(true);
            }}
          >
            <Icon name="add" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search customers by name or phone..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity style={styles.clearSearchButton} onPress={() => setSearchQuery('')}>
            <Icon name="close" size={18} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      {/* Customer Count */}
      <View style={styles.customerCountContainer}>
        <Text style={styles.customerCountText}>
          {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? 's' : ''}
          {searchQuery ? ` found for "${searchQuery}"` : ''}
        </Text>
        <Text style={styles.sortText}>Sorted by: Last Updated</Text>
      </View>

      {/* ✅ Pull-to-refresh added here */}
      <FlatList
        data={filteredCustomers}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={styles.listCard}
            onPress={() => navigation.navigate('CustomerDetails', { customer: item })}
          >
            <View style={styles.listCardHeader}>
              <View style={styles.customerInfo}>
                <Text style={styles.customerIndex}>#{index + 1}</Text>
                <View>
                  <Text style={styles.listCardTitle}>{item.name}</Text>
                  {(item.createdAt || item.updatedAt) && (
                    <Text style={styles.customerDate}>
                      {item.updatedAt ? `Updated: ${item.updatedAt}` : `Added: ${item.createdAt}`}
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.listCardActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => {
                    setCurrentCustomer({
                      id: item.id,
                      name: item.name || '',
                      phone: item.phone || '',
                      balance: String(item.balance ?? '0'),
                    });
                    setModalVisible(true);
                  }}
                >
                  <Icon name="edit" size={18} color="#007AFF" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => deleteCustomer(item.id)}
                >
                  <Icon name="delete" size={18} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            </View>

            {item.phone ? (
              <View style={styles.phoneContainer}>
                <Icon name="phone" size={14} color="#666" />
                <Text style={styles.listCardText}> {item.phone}</Text>
              </View>
            ) : null}

            <View style={styles.balanceContainer}>
              <Text
                style={[
                  styles.balanceText,
                  item.balance > 0
                    ? styles.positiveBalance
                    : item.balance < 0
                    ? styles.negativeBalance
                    : styles.neutralBalance,
                ]}
              >
                Balance: {formatCurrency(item.balance)}
              </Text>

              <View style={styles.balanceStatus}>
                <Text
                  style={[
                    styles.balanceStatusText,
                    item.balance > 0
                      ? styles.positiveStatus
                      : item.balance < 0
                      ? styles.negativeStatus
                      : styles.neutralStatus,
                  ]}
                >
                  {item.balance > 0
                    ? 'You owe customer'
                    : item.balance < 0
                    ? 'Customer owes you'
                    : 'Settled'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="people-outline" size={64} color="#ccc" />
            <Text style={styles.emptyStateText}>
              {searchQuery ? 'No customers found' : 'No customers yet'}
            </Text>
            <Text style={styles.emptyStateSubtext}>
              {searchQuery ? 'Try a different search term' : 'Add your first customer to get started'}
            </Text>
          </View>
        }
      />

      {/* Add/Edit Customer Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {currentCustomer.id ? '✏️ Edit Customer' : '👥 Add New Customer'}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Customer Name *"
              value={currentCustomer.name}
              onChangeText={(text) => setCurrentCustomer({ ...currentCustomer, name: text })}
            />

            <TextInput
              style={styles.input}
              placeholder="Phone Number (Optional)"
              value={currentCustomer.phone}
              onChangeText={(text) => setCurrentCustomer({ ...currentCustomer, phone: text })}
              keyboardType="phone-pad"
            />

            <TextInput
              style={styles.input}
              placeholder="Initial Balance (BDT)"
              value={currentCustomer.balance}
              onChangeText={(text) => setCurrentCustomer({ ...currentCustomer, balance: text })}
              keyboardType="numeric"
            />

            {currentCustomer.balance ? (
              <View style={styles.balancePreview}>
                <Text style={styles.balancePreviewText}>
                  Balance: {formatCurrency(parseFloat(currentCustomer.balance) || 0)}
                </Text>
                <Text
                  style={[
                    styles.balancePreviewStatus,
                    parseFloat(currentCustomer.balance) > 0
                      ? styles.positiveBalance
                      : parseFloat(currentCustomer.balance) < 0
                      ? styles.negativeBalance
                      : styles.neutralBalance,
                  ]}
                >
                  {parseFloat(currentCustomer.balance) > 0
                    ? 'You will owe customer'
                    : parseFloat(currentCustomer.balance) < 0
                    ? 'Customer will owe you'
                    : 'Settled'}
                </Text>
              </View>
            ) : null}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={saveCustomer}
              >
                <Text style={styles.modalButtonText}>
                  {currentCustomer.id ? 'Update' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>
    </View>
  );
}
