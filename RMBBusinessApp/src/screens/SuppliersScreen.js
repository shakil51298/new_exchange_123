import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
  Alert,
  RefreshControl,
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

import { MaterialCommunityIcons as Icon } from '@expo/vector-icons'; // ✅ same as Dashboard

import { db } from '../config/firebase';
import styles from '../styles/styles';
import { formatUSD } from '../utils/format';
import { getTodayDate } from '../utils/date';

export default function SuppliersScreen({ navigation }) {
  const [suppliers, setSuppliers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [currentSupplier, setCurrentSupplier] = useState({
    id: '',
    name: '',
    type: 'RMB', // RMB or USDT
    contact: '',
    balanceUSD: '0',
  });

  const sortSuppliers = useCallback((list) => {
    const arr = [...(list || [])];
    arr.sort((a, b) => {
      const dateA = a.updatedAt ? new Date(a.updatedAt) : new Date(a.createdAt || 0);
      const dateB = b.updatedAt ? new Date(b.updatedAt) : new Date(b.createdAt || 0);
      return dateB - dateA;
    });
    return arr;
  }, []);

  const loadSuppliersFromStorage = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem('suppliers');
      if (stored) {
        const list = sortSuppliers(JSON.parse(stored));
        setSuppliers(list);
      }
    } catch (error) {
      console.error('Error loading suppliers:', error);
    }
  }, [sortSuppliers]);

  // ✅ Manual fetch (for pull-to-refresh)
  const fetchSuppliersOnce = useCallback(async () => {
    const snap = await getDocs(collection(db, 'suppliers'));
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const sorted = sortSuppliers(list);
    setSuppliers(sorted);
    await AsyncStorage.setItem('suppliers', JSON.stringify(sorted));
  }, [sortSuppliers]);

  // ✅ Realtime snapshot (kept)
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'suppliers'),
      async (snapshot) => {
        const list = [];
        snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
        const sorted = sortSuppliers(list);
        setSuppliers(sorted);
        AsyncStorage.setItem('suppliers', JSON.stringify(sorted));
      },
      async (error) => {
        console.error('Firestore error:', error);
        await loadSuppliersFromStorage();
      }
    );

    return () => unsubscribe();
  }, [loadSuppliersFromStorage, sortSuppliers]);

  // ✅ Pull-to-refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchSuppliersOnce();
    } catch (e) {
      console.error('Supplier refresh failed:', e);
      await loadSuppliersFromStorage();
      Alert.alert('Offline', 'Loaded suppliers from device storage.');
    } finally {
      setRefreshing(false);
    }
  }, [fetchSuppliersOnce, loadSuppliersFromStorage]);

  const filteredSuppliers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return suppliers;

    return suppliers.filter((supplier) => {
      const name = (supplier.name || '').toLowerCase();
      const contact = supplier.contact || '';
      const type = (supplier.type || '').toLowerCase();
      return name.includes(q) || contact.includes(searchQuery.trim()) || type.includes(q);
    });
  }, [suppliers, searchQuery]);

  const saveSupplier = async () => {
    if (!currentSupplier.name.trim()) {
      Alert.alert('Error', 'Supplier name is required');
      return;
    }

    try {
      const supplierData = {
        name: currentSupplier.name.trim(),
        type: currentSupplier.type,
        contact: currentSupplier.contact?.trim() || '',
        balanceUSD: parseFloat(currentSupplier.balanceUSD) || 0,
        updatedAt: getTodayDate(),
      };

      if (!currentSupplier.id) {
        supplierData.createdAt = getTodayDate();
      }

      // ✅ Update UI immediately
      let updated;
      if (currentSupplier.id) {
        updated = suppliers.map((s) =>
          s.id === currentSupplier.id ? { ...s, ...supplierData, id: currentSupplier.id } : s
        );
      } else {
        const tempId = `temp_${Date.now()}`;
        updated = [{ ...supplierData, id: tempId }, ...suppliers];
      }

      updated = sortSuppliers(updated);
      setSuppliers(updated);
      await AsyncStorage.setItem('suppliers', JSON.stringify(updated));

      // ✅ Save to Firestore
      if (currentSupplier.id) {
        const updateData = { ...supplierData };
        delete updateData.createdAt;
        await updateDoc(doc(db, 'suppliers', currentSupplier.id), updateData);
        Alert.alert('Success', 'Supplier updated!');
      } else {
        const docRef = await addDoc(collection(db, 'suppliers'), supplierData);
        const realSupplier = { id: docRef.id, ...supplierData };

        const finalList = updated.map((s) =>
          typeof s.id === 'string' && s.id.startsWith('temp_') ? realSupplier : s
        );

        const sortedFinal = sortSuppliers(finalList);
        setSuppliers(sortedFinal);
        await AsyncStorage.setItem('suppliers', JSON.stringify(sortedFinal));

        Alert.alert('Success', 'Supplier added!');
      }

      setModalVisible(false);
      setCurrentSupplier({ id: '', name: '', type: 'RMB', contact: '', balanceUSD: '0' });
    } catch (error) {
      console.error('Error saving supplier:', error);
      Alert.alert('Saved locally', 'Could not sync to cloud. Saved to device storage.');
      setModalVisible(false);
      setCurrentSupplier({ id: '', name: '', type: 'RMB', contact: '', balanceUSD: '0' });
    }
  };

  const deleteSupplier = (supplierId) => {
    Alert.alert(
      'Delete Supplier',
      'Are you sure you want to delete this supplier? All transactions will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'suppliers', supplierId));

              const updated = suppliers.filter((s) => s.id !== supplierId);
              setSuppliers(updated);
              await AsyncStorage.setItem('suppliers', JSON.stringify(updated));
              await AsyncStorage.removeItem(`supplier_transactions_${supplierId}`);

              Alert.alert('Success', 'Supplier deleted!');
            } catch (error) {
              console.error('Error deleting supplier:', error);

              const updated = suppliers.filter((s) => s.id !== supplierId);
              setSuppliers(updated);
              await AsyncStorage.setItem('suppliers', JSON.stringify(updated));
              await AsyncStorage.removeItem(`supplier_transactions_${supplierId}`);

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
        <Text style={styles.screenTitle}>Supplier Management</Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>

          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              setCurrentSupplier({ id: '', name: '', type: 'RMB', contact: '', balanceUSD: '0' });
              setModalVisible(true);
            }}
          >
            <Icon name="plus" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Icon name="magnify" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search suppliers by name, contact, or type..."
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

      {/* Count */}
      <View style={styles.customerCountContainer}>
        <Text style={styles.customerCountText}>
          {filteredSuppliers.length} supplier{filteredSuppliers.length !== 1 ? 's' : ''}
          {searchQuery ? ` found for "${searchQuery}"` : ''}
        </Text>
        <Text style={styles.sortText}>Sorted by: Last Updated</Text>
      </View>

      {/* ✅ Pull-to-refresh here */}
      <FlatList
        data={filteredSuppliers}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={styles.listCard}
            onPress={() => navigation.navigate('SupplierDetails', { supplier: item })}
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
                    setCurrentSupplier({
                      id: item.id,
                      name: item.name || '',
                      type: item.type || 'RMB',
                      contact: item.contact || '',
                      balanceUSD: String(item.balanceUSD ?? '0'),
                    });
                    setModalVisible(true);
                  }}
                >
                  <Icon name="pencil" size={18} color="#007AFF" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => deleteSupplier(item.id)}
                >
                  <Icon name="trash-can-outline" size={18} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.supplierTypeContainer}>
              <Text
                style={[
                  styles.supplierType,
                  item.type === 'RMB' ? styles.rmbType : styles.usdtType,
                ]}
              >
                {item.type} Supplier
              </Text>

              {item.contact ? (
                <View style={styles.phoneContainer}>
                  <Icon name="phone" size={14} color="#666" />
                  <Text style={styles.listCardText}> {item.contact}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.balanceContainer}>
              <Text
                style={[
                  styles.balanceText,
                  (item.balanceUSD || 0) > 0
                    ? styles.positiveBalance
                    : (item.balanceUSD || 0) < 0
                      ? styles.negativeBalance
                      : styles.neutralBalance,
                ]}
              >
                Balance: {formatUSD(item.balanceUSD || 0)}
              </Text>

              <View style={styles.balanceStatus}>
                <Text
                  style={[
                    styles.balanceStatusText,
                    (item.balanceUSD || 0) > 0
                      ? styles.positiveStatus
                      : (item.balanceUSD || 0) < 0
                        ? styles.negativeStatus
                        : styles.neutralStatus,
                  ]}
                >
                  {(item.balanceUSD || 0) > 0
                    ? 'You owe supplier'
                    : (item.balanceUSD || 0) < 0
                      ? 'Supplier owes you'
                      : 'Settled'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="office-building" size={64} color="#ccc" />
            <Text style={styles.emptyStateText}>
              {searchQuery ? 'No suppliers found' : 'No suppliers yet'}
            </Text>
            <Text style={styles.emptyStateSubtext}>
              {searchQuery ? 'Try a different search term' : 'Add your first supplier'}
            </Text>
          </View>
        }
      />

      {/* Add/Edit Supplier Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {currentSupplier.id ? '✏️ Edit Supplier' : '🏢 Add New Supplier'}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Supplier Name *"
              value={currentSupplier.name}
              onChangeText={(text) => setCurrentSupplier({ ...currentSupplier, name: text })}
            />

            <View style={styles.radioGroup}>
              <TouchableOpacity
                style={[
                  styles.radioButton,
                  currentSupplier.type === 'RMB' && styles.radioButtonSelected,
                ]}
                onPress={() => setCurrentSupplier({ ...currentSupplier, type: 'RMB' })}
              >
                <Text
                  style={
                    currentSupplier.type === 'RMB'
                      ? styles.radioButtonTextSelected
                      : styles.radioButtonText
                  }
                >
                  RMB Supplier
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.radioButton,
                  currentSupplier.type === 'USDT' && styles.radioButtonSelected,
                ]}
                onPress={() => setCurrentSupplier({ ...currentSupplier, type: 'USDT' })}
              >
                <Text
                  style={
                    currentSupplier.type === 'USDT'
                      ? styles.radioButtonTextSelected
                      : styles.radioButtonText
                  }
                >
                  USDT Supplier
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Contact (Optional)"
              value={currentSupplier.contact}
              onChangeText={(text) => setCurrentSupplier({ ...currentSupplier, contact: text })}
            />

            <TextInput
              style={styles.input}
              placeholder="Balance ($)"
              value={currentSupplier.balanceUSD}
              onChangeText={(text) => setCurrentSupplier({ ...currentSupplier, balanceUSD: text })}
              keyboardType="numeric"
            />

            {currentSupplier.balanceUSD ? (
              <View style={styles.balancePreview}>
                <Text style={styles.balancePreviewText}>
                  Balance: {formatUSD(parseFloat(currentSupplier.balanceUSD) || 0)}
                </Text>
                <Text
                  style={[
                    styles.balancePreviewStatus,
                    parseFloat(currentSupplier.balanceUSD) > 0
                      ? styles.positiveBalance
                      : parseFloat(currentSupplier.balanceUSD) < 0
                        ? styles.negativeBalance
                        : styles.neutralBalance,
                  ]}
                >
                  {parseFloat(currentSupplier.balanceUSD) > 0
                    ? 'You will owe supplier'
                    : parseFloat(currentSupplier.balanceUSD) < 0
                      ? 'Supplier will owe you'
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
                onPress={saveSupplier}
              >
                <Text style={styles.modalButtonText}>
                  {currentSupplier.id ? 'Update' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
