// src/screens/CustomersScreen.js
import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Modal, Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';

import { db } from '../config/firebase';
import styles from '../styles/styles';

import { formatCurrency } from '../utils/format';
import { getTodayDate } from '../utils/date';

export default function CustomersScreen({ navigation }) {
    const [customers, setCustomers] = useState([]);
    const [filteredCustomers, setFilteredCustomers] = useState([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentCustomer, setCurrentCustomer] = useState({
      id: '',
      name: '',
      phone: '',
      balance: '0',
    });
  
    // Load customers from Firestore
    useEffect(() => {
      const unsubscribe = onSnapshot(collection(db, 'customers'), (snapshot) => {
        const customersList = [];
        snapshot.forEach((doc) => {
          customersList.push({ id: doc.id, ...doc.data() });
        });
        // Sort by updatedAt (newest first)
        customersList.sort((a, b) => {
          const dateA = a.updatedAt ? new Date(a.updatedAt) : new Date(a.createdAt || 0);
          const dateB = b.updatedAt ? new Date(b.updatedAt) : new Date(b.createdAt || 0);
          return dateB - dateA;
        });
        setCustomers(customersList);
        setFilteredCustomers(customersList);
        // Also save to AsyncStorage for offline backup
        AsyncStorage.setItem('customers', JSON.stringify(customersList));
      }, (error) => {
        console.error("Firestore error:", error);
        // Fallback to AsyncStorage
        loadCustomersFromStorage();
      });
  
      return () => unsubscribe();
    }, []);
  
    useEffect(() => {
      // Filter customers based on search query
      if (searchQuery.trim() === '') {
        setFilteredCustomers(customers);
      } else {
        const filtered = customers.filter(customer =>
          customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (customer.phone && customer.phone.includes(searchQuery))
        );
        setFilteredCustomers(filtered);
      }
    }, [searchQuery, customers]);
  
    const loadCustomersFromStorage = async () => {
      try {
        const storedCustomers = await AsyncStorage.getItem('customers');
        if (storedCustomers) {
          const customersList = JSON.parse(storedCustomers);
          // Sort by updatedAt (newest first)
          customersList.sort((a, b) => {
            const dateA = a.updatedAt ? new Date(a.updatedAt) : new Date(a.createdAt || 0);
            const dateB = b.updatedAt ? new Date(b.updatedAt) : new Date(b.createdAt || 0);
            return dateB - dateA;
          });
          setCustomers(customersList);
          setFilteredCustomers(customersList);
        }
      } catch (error) {
        console.error('Error loading customers:', error);
      }
    };
  
    const saveCustomer = async () => {
      if (!currentCustomer.name.trim()) {
        Alert.alert('Error', 'Customer name is required');
        return;
      }
    
      // Show loading
      Alert.alert('Saving...', 'Please wait', [], { cancelable: false });
    
      try {
        const balanceValue = parseFloat(currentCustomer.balance) || 0;
        const customerData = {
          name: currentCustomer.name.trim(),
          phone: currentCustomer.phone?.trim() || '',
          balance: balanceValue,
          updatedAt: getTodayDate(),
        };
    
        // Only add createdAt for new customers
        if (!currentCustomer.id) {
          customerData.createdAt = getTodayDate();
        }
    
        // UPDATE UI IMMEDIATELY
        let updatedCustomers;
        if (currentCustomer.id) {
          // Update in local state immediately
          updatedCustomers = customers.map(c => 
            c.id === currentCustomer.id ? { 
              ...c, 
              ...customerData,
              id: currentCustomer.id // Keep the ID
            } : c
          );
        } else {
          // Add to local state immediately with temporary ID
          const tempId = `temp_${Date.now()}`;
          const newCustomer = {
            ...customerData,
            id: tempId,
          };
          updatedCustomers = [newCustomer, ...customers];
        }
    
        // Update state immediately
        setCustomers(updatedCustomers);
        setFilteredCustomers(updatedCustomers);
        
        // Save to AsyncStorage immediately
        await AsyncStorage.setItem('customers', JSON.stringify(updatedCustomers));
    
        // Now save to Firestore in background
        if (currentCustomer.id) {
          // Update existing customer in Firestore
          const updateData = { ...customerData };
          delete updateData.createdAt; // Remove createdAt for updates
          
          await updateDoc(doc(db, 'customers', currentCustomer.id), updateData);
          
          Alert.alert('Success', 'Customer updated in cloud!');
        } else {
          // Add new customer to Firestore
          const docRef = await addDoc(collection(db, 'customers'), customerData);
          const newCustomer = { id: docRef.id, ...customerData };
          
          // Replace temporary ID with real Firestore ID
          const finalCustomers = updatedCustomers.map(c => 
            c.id.startsWith('temp_') ? newCustomer : c
          );
          
          // Update with real ID
          setCustomers(finalCustomers);
          setFilteredCustomers(finalCustomers);
          await AsyncStorage.setItem('customers', JSON.stringify(finalCustomers));
          
          Alert.alert('Success', 'Customer saved to cloud!');
        }
    
        // Reset and close modal
        setModalVisible(false);
        setCurrentCustomer({ id: '', name: '', phone: '', balance: '0' });
        
      } catch (error) {
        console.error('Error saving customer:', error);
        
        // Revert to original state if Firestore fails
        loadCustomersFromStorage();
        
        Alert.alert('Error', `Failed to save to cloud: ${error.message}`);
        
        // Still keep local changes
        setModalVisible(false);
        setCurrentCustomer({ id: '', name: '', phone: '', balance: '0' });
        Alert.alert('Saved locally', 'Customer saved to device storage');
      }
    };
  
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
                // Delete from Firestore
                await deleteDoc(doc(db, 'customers', customerId));
                
                // Delete from AsyncStorage
                const updatedCustomers = customers.filter(c => c.id !== customerId);
                setCustomers(updatedCustomers);
                setFilteredCustomers(updatedCustomers);
                await AsyncStorage.setItem('customers', JSON.stringify(updatedCustomers));
                
                // Delete associated transactions from AsyncStorage
                await AsyncStorage.removeItem(`transactions_${customerId}`);
                
                Alert.alert('Success', 'Customer deleted from cloud!');
              } catch (error) {
                console.error('Error deleting customer:', error);
                // Fallback to AsyncStorage
                const updatedCustomers = customers.filter(c => c.id !== customerId);
                setCustomers(updatedCustomers);
                setFilteredCustomers(updatedCustomers);
                await AsyncStorage.setItem('customers', JSON.stringify(updatedCustomers));
                Alert.alert('Deleted locally', 'Customer deleted from device storage');
              }
            },
          },
        ]
      );
    };
  
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.screenTitle}>👥 Customer Management</Text>
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
            <TouchableOpacity 
              style={styles.clearSearchButton}
              onPress={() => setSearchQuery('')}
            >
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
  
        <FlatList
          data={filteredCustomers}
          keyExtractor={(item) => item.id}
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
                      setCurrentCustomer(item);
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
                <Text style={[
                  styles.balanceText,
                  item.balance > 0 ? styles.positiveBalance : 
                  item.balance < 0 ? styles.negativeBalance : styles.neutralBalance
                ]}>
                  Balance: {formatCurrency(item.balance)}
                </Text>
                <View style={styles.balanceStatus}>
                  <Text style={[
                    styles.balanceStatusText,
                    item.balance > 0 ? styles.positiveStatus : 
                    item.balance < 0 ? styles.negativeStatus : styles.neutralStatus
                  ]}>
                    {item.balance > 0 ? 'You owe customer' : 
                     item.balance < 0 ? 'Customer owes you' : 'Settled'}
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
          transparent={true}
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
                onChangeText={(text) => setCurrentCustomer({...currentCustomer, name: text})}
              />
              
              <TextInput
                style={styles.input}
                placeholder="Phone Number (Optional)"
                value={currentCustomer.phone}
                onChangeText={(text) => setCurrentCustomer({...currentCustomer, phone: text})}
                keyboardType="phone-pad"
              />
              
              <TextInput
                style={styles.input}
                placeholder="Initial Balance (BDT)"
                value={currentCustomer.balance}
                onChangeText={(text) => setCurrentCustomer({...currentCustomer, balance: text})}
                keyboardType="numeric"
              />
              
              {currentCustomer.balance && (
                <View style={styles.balancePreview}>
                  <Text style={styles.balancePreviewText}>
                    Balance: {formatCurrency(parseFloat(currentCustomer.balance) || 0)}
                  </Text>
                  <Text style={[
                    styles.balancePreviewStatus,
                    parseFloat(currentCustomer.balance) > 0 ? styles.positiveBalance : 
                    parseFloat(currentCustomer.balance) < 0 ? styles.negativeBalance : styles.neutralBalance
                  ]}>
                    {parseFloat(currentCustomer.balance) > 0 ? 'You will owe customer' : 
                     parseFloat(currentCustomer.balance) < 0 ? 'Customer will owe you' : 'Settled'}
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