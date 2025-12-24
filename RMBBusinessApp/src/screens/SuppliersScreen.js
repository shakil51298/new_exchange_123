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
  
import Icon from 'react-native-vector-icons/MaterialIcons';


import { db } from '../config/firebase';
import styles from '../styles/styles';

import { formatUSD } from '../utils/format';

export default function SuppliersScreen({ navigation }) {
        const [suppliers, setSuppliers] = useState([]);
        const [filteredSuppliers, setFilteredSuppliers] = useState([]);
        const [modalVisible, setModalVisible] = useState(false);
        const [searchQuery, setSearchQuery] = useState('');
        const [currentSupplier, setCurrentSupplier] = useState({
          id: '',
          name: '',
          type: 'RMB', // RMB or USDT
          contact: '',
          balanceUSD: '0',
        });
      
        // Load suppliers from Firestore
        useEffect(() => {
          const unsubscribe = onSnapshot(collection(db, 'suppliers'), (snapshot) => {
            const suppliersList = [];
            snapshot.forEach((doc) => {
              suppliersList.push({ id: doc.id, ...doc.data() });
            });
            // Sort by updatedAt (newest first)
            suppliersList.sort((a, b) => {
              const dateA = a.updatedAt ? new Date(a.updatedAt) : new Date(a.createdAt || 0);
              const dateB = b.updatedAt ? new Date(b.updatedAt) : new Date(b.createdAt || 0);
              return dateB - dateA;
            });
            setSuppliers(suppliersList);
            setFilteredSuppliers(suppliersList);
            // Also save to AsyncStorage for offline backup
            AsyncStorage.setItem('suppliers', JSON.stringify(suppliersList));
          }, (error) => {
            console.error("Firestore error:", error);
            // Fallback to AsyncStorage
            loadSuppliersFromStorage();
          });
      
          return () => unsubscribe();
        }, []);
      
        useEffect(() => {
          // Filter suppliers based on search query
          if (searchQuery.trim() === '') {
            setFilteredSuppliers(suppliers);
          } else {
            const filtered = suppliers.filter(supplier =>
              supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              (supplier.contact && supplier.contact.includes(searchQuery)) ||
              supplier.type.toLowerCase().includes(searchQuery.toLowerCase())
            );
            setFilteredSuppliers(filtered);
          }
        }, [searchQuery, suppliers]);
      
        const loadSuppliersFromStorage = async () => {
          try {
            const storedSuppliers = await AsyncStorage.getItem('suppliers');
            if (storedSuppliers) {
              const suppliersList = JSON.parse(storedSuppliers);
              // Sort by updatedAt (newest first)
              suppliersList.sort((a, b) => {
                const dateA = a.updatedAt ? new Date(a.updatedAt) : new Date(a.createdAt || 0);
                const dateB = b.updatedAt ? new Date(b.updatedAt) : new Date(b.createdAt || 0);
                return dateB - dateA;
              });
              setSuppliers(suppliersList);
              setFilteredSuppliers(suppliersList);
            }
          } catch (error) {
            console.error('Error loading suppliers:', error);
          }
        };
      
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
      
            // Only add createdAt for new suppliers
            if (!currentSupplier.id) {
              supplierData.createdAt = getTodayDate();
            }
      
            if (currentSupplier.id) {
              // Update existing supplier in Firestore - remove createdAt
              const updateData = { ...supplierData };
              delete updateData.createdAt; // Remove createdAt for updates
              
              await updateDoc(doc(db, 'suppliers', currentSupplier.id), updateData);
              
              // Update in AsyncStorage
              const updatedSuppliers = suppliers.map(s => 
                s.id === currentSupplier.id ? { ...currentSupplier, ...supplierData } : s
              );
              await AsyncStorage.setItem('suppliers', JSON.stringify(updatedSuppliers));
              setSuppliers(updatedSuppliers);
              setFilteredSuppliers(updatedSuppliers);
              
              Alert.alert('Success', 'Supplier updated in cloud!');
            } else {
              // Add new supplier to Firestore
              const docRef = await addDoc(collection(db, 'suppliers'), supplierData);
              const newSupplier = { id: docRef.id, ...supplierData };
              
              // Add to AsyncStorage
              const updatedSuppliers = [newSupplier, ...suppliers];
              await AsyncStorage.setItem('suppliers', JSON.stringify(updatedSuppliers));
              setSuppliers(updatedSuppliers);
              setFilteredSuppliers(updatedSuppliers);
              
              Alert.alert('Success', 'Supplier saved to cloud!');
            }
      
            // Reset and close modal
            setModalVisible(false);
            setCurrentSupplier({ id: '', name: '', type: 'RMB', contact: '', balanceUSD: '0' });
            
          } catch (error) {
            console.error('Error saving supplier:', error);
            Alert.alert('Error', `Failed to save: ${error.message}`);
            
            // Fallback to AsyncStorage only
            const balanceValue = parseFloat(currentSupplier.balanceUSD) || 0;
            let updatedSuppliers;
            
            if (currentSupplier.id) {
              // Update locally
              updatedSuppliers = suppliers.map(s => 
                s.id === currentSupplier.id ? { 
                  ...currentSupplier, 
                  balanceUSD: balanceValue,
                  updatedAt: getTodayDate()
                } : s
              );
            } else {
              // Add new locally
              const newSupplier = {
                ...currentSupplier,
                id: Date.now().toString(),
                createdAt: getTodayDate(),
                balanceUSD: balanceValue,
                updatedAt: getTodayDate(),
              };
              updatedSuppliers = [newSupplier, ...suppliers];
            }
      
            setSuppliers(updatedSuppliers);
            setFilteredSuppliers(updatedSuppliers);
            await AsyncStorage.setItem('suppliers', JSON.stringify(updatedSuppliers));
            
            setModalVisible(false);
            setCurrentSupplier({ id: '', name: '', type: 'RMB', contact: '', balanceUSD: '0' });
            Alert.alert('Saved locally', 'Supplier saved to device storage');
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
                    // Delete from Firestore
                    await deleteDoc(doc(db, 'suppliers', supplierId));
                    
                    // Delete from AsyncStorage
                    const updatedSuppliers = suppliers.filter(s => s.id !== supplierId);
                    setSuppliers(updatedSuppliers);
                    setFilteredSuppliers(updatedSuppliers);
                    await AsyncStorage.setItem('suppliers', JSON.stringify(updatedSuppliers));
                    
                    // Delete associated transactions from AsyncStorage
                    await AsyncStorage.removeItem(`supplier_transactions_${supplierId}`);
                    
                    Alert.alert('Success', 'Supplier deleted from cloud!');
                  } catch (error) {
                    console.error('Error deleting supplier:', error);
                    // Fallback to AsyncStorage
                    const updatedSuppliers = suppliers.filter(s => s.id !== supplierId);
                    setSuppliers(updatedSuppliers);
                    setFilteredSuppliers(updatedSuppliers);
                    await AsyncStorage.setItem('suppliers', JSON.stringify(updatedSuppliers));
                    Alert.alert('Deleted locally', 'Supplier deleted from device storage');
                  }
                },
              },
            ]
          );
        };
      
        return (
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.screenTitle}>🏢 Supplier Management</Text>
              <TouchableOpacity 
                style={styles.addButton}
                onPress={() => {
                  setCurrentSupplier({ id: '', name: '', type: 'RMB', contact: '', balanceUSD: '0' });
                  setModalVisible(true);
                }}
              >
                <Icon name="add" size={24} color="white" />
              </TouchableOpacity>
            </View>
      
            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <Icon name="search" size={20} color="#666" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search suppliers by name, contact, or type..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity 
                  style={styles.clearSearchButton}
                  onPress={() => setSearchQuery('')}
                >
                  <Icon name="close" size={18} color="#666" />
                </TouchableOpacity>
              )}
            </View>
      
            {/* Supplier Count */}
            <View style={styles.customerCountContainer}>
              <Text style={styles.customerCountText}>
                {filteredSuppliers.length} supplier{filteredSuppliers.length !== 1 ? 's' : ''}
                {searchQuery ? ` found for "${searchQuery}"` : ''}
              </Text>
              <Text style={styles.sortText}>Sorted by: Last Updated</Text>
            </View>
      
            <FlatList
              data={filteredSuppliers}
              keyExtractor={(item) => item.id}
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
                          setCurrentSupplier(item);
                          setModalVisible(true);
                        }}
                      >
                        <Icon name="edit" size={18} color="#007AFF" />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.actionButton}
                        onPress={() => deleteSupplier(item.id)}
                      >
                        <Icon name="delete" size={18} color="#FF3B30" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  <View style={styles.supplierTypeContainer}>
                    <Text style={[
                      styles.supplierType,
                      item.type === 'RMB' ? styles.rmbType : styles.usdtType
                    ]}>
                      {item.type} Supplier
                    </Text>
                    {item.contact && (
                      <View style={styles.phoneContainer}>
                        <Icon name="phone" size={14} color="#666" />
                        <Text style={styles.listCardText}> {item.contact}</Text>
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.balanceContainer}>
                    <Text style={[
                      styles.balanceText,
                      (item.balanceUSD || 0) > 0 ? styles.positiveBalance : 
                      (item.balanceUSD || 0) < 0 ? styles.negativeBalance : styles.neutralBalance
                    ]}>
                      Balance: {formatUSD(item.balanceUSD || 0)}
                    </Text>
                    <View style={styles.balanceStatus}>
                      <Text style={[
                        styles.balanceStatusText,
                        (item.balanceUSD || 0) > 0 ? styles.positiveStatus : 
                        (item.balanceUSD || 0) < 0 ? styles.negativeStatus : styles.neutralStatus
                      ]}>
                        {(item.balanceUSD || 0) > 0 ? 'You owe supplier' : 
                         (item.balanceUSD || 0) < 0 ? 'Supplier owes you' : 'Settled'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Icon name="business" size={64} color="#ccc" />
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
              transparent={true}
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
                    onChangeText={(text) => setCurrentSupplier({...currentSupplier, name: text})}
                  />
                  
                  <View style={styles.radioGroup}>
                    <TouchableOpacity
                      style={[
                        styles.radioButton,
                        currentSupplier.type === 'RMB' && styles.radioButtonSelected
                      ]}
                      onPress={() => setCurrentSupplier({...currentSupplier, type: 'RMB'})}
                    >
                      <Text style={currentSupplier.type === 'RMB' ? styles.radioButtonTextSelected : styles.radioButtonText}>
                        RMB Supplier
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.radioButton,
                        currentSupplier.type === 'USDT' && styles.radioButtonSelected
                      ]}
                      onPress={() => setCurrentSupplier({...currentSupplier, type: 'USDT'})}
                    >
                      <Text style={currentSupplier.type === 'USDT' ? styles.radioButtonTextSelected : styles.radioButtonText}>
                        USDT Supplier
                      </Text>
                    </TouchableOpacity>
                  </View>
                  
                  <TextInput
                    style={styles.input}
                    placeholder="Contact (Optional)"
                    value={currentSupplier.contact}
                    onChangeText={(text) => setCurrentSupplier({...currentSupplier, contact: text})}
                  />
                  
                  <TextInput
                    style={styles.input}
                    placeholder="Balance ($)"
                    value={currentSupplier.balanceUSD}
                    onChangeText={(text) => setCurrentSupplier({...currentSupplier, balanceUSD: text})}
                    keyboardType="numeric"
                  />
                  
                  {currentSupplier.balanceUSD && (
                    <View style={styles.balancePreview}>
                      <Text style={styles.balancePreviewText}>
                        Balance: {formatUSD(parseFloat(currentSupplier.balanceUSD) || 0)}
                      </Text>
                      <Text style={[
                        styles.balancePreviewStatus,
                        parseFloat(currentSupplier.balanceUSD) > 0 ? styles.positiveBalance : 
                        parseFloat(currentSupplier.balanceUSD) < 0 ? styles.negativeBalance : styles.neutralBalance
                      ]}>
                        {parseFloat(currentSupplier.balanceUSD) > 0 ? 'You will owe supplier' : 
                         parseFloat(currentSupplier.balanceUSD) < 0 ? 'Supplier will owe you' : 'Settled'}
                      </Text>
                    </View>
                  )}
                  
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
