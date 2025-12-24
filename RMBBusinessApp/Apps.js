import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Modal,
} from 'react-native';

// ==================== FIREBASE CONFIGURATION ====================
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot 
} from 'firebase/firestore';

// ⚠️ REPLACE THIS WITH YOUR ACTUAL FIREBASE CONFIG FROM FIREBASE CONSOLE
const firebaseConfig = {
  apiKey: "AIzaSyDGyAvudD29KVysZC85SHAl81zgZuZ9bBo",
  authDomain: "rmbbusiness-92c73.firebaseapp.com",
  projectId: "rmbbusiness-92c73",
  storageBucket: "rmbbusiness-92c73.firebasestorage.app",
  messagingSenderId: "1033450127434",
  appId: "1:1033450127434:web:c914cdebaa87da287826b3",
  measurementId: "G-YRL4KV8PYB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ==================== UTILITY FUNCTIONS ====================
const formatCurrency = (amount, currency = 'BDT') => {
  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const formatted = formatter.format(Math.abs(amount || 0));
  const sign = amount < 0 ? '-' : amount > 0 ? '+' : '';
  return `${sign} ${formatted} ${currency}`;
};

const formatUSD = (amount) => {
  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const formatted = formatter.format(Math.abs(amount || 0));
  const sign = amount < 0 ? '-' : amount > 0 ? '+' : '';
  return `${sign} $${formatted}`;
};

const getTodayDate = () => {
  return new Date().toISOString().split('T')[0];
};

// ==================== FIXED DASHBOARD CALCULATION ====================
const DashboardScreen = ({ navigation }) => {
  const [usdRate, setUsdRate] = useState('125'); // Default rate 1$ = 125 BDT
  const [balances, setBalances] = useState({
    customers: [],
    suppliers: [],
    agents: [],
    banks: [],
    wallets: [],
  });

  const [summary, setSummary] = useState({
    totalCustomersBDT: 0,
    totalSuppliersBDT: 0,
    totalAgentsBDT: 0,
    totalBanksBDT: 0,
    totalWalletsBDT: 0,
    totalMoney: 0,
  });

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    calculateSummary();
  }, [balances, usdRate]);

  const loadAllData = async () => {
    try {
      // Load from Firestore instead of AsyncStorage
      const customersSnapshot = await getDocs(collection(db, 'customers'));
      const customersData = [];
      customersSnapshot.forEach((doc) => {
        customersData.push({ id: doc.id, ...doc.data() });
      });

      const suppliersSnapshot = await getDocs(collection(db, 'suppliers'));
      const suppliersData = [];
      suppliersSnapshot.forEach((doc) => {
        suppliersData.push({ id: doc.id, ...doc.data() });
      });

      const agentsSnapshot = await getDocs(collection(db, 'agents'));
      const agentsData = [];
      agentsSnapshot.forEach((doc) => {
        agentsData.push({ id: doc.id, ...doc.data() });
      });

      const banksSnapshot = await getDocs(collection(db, 'banks'));
      const banksData = [];
      banksSnapshot.forEach((doc) => {
        banksData.push({ id: doc.id, ...doc.data() });
      });

      const walletsSnapshot = await getDocs(collection(db, 'wallets'));
      const walletsData = [];
      walletsSnapshot.forEach((doc) => {
        walletsData.push({ id: doc.id, ...doc.data() });
      });

      setBalances({
        customers: customersData,
        suppliers: suppliersData,
        agents: agentsData,
        banks: banksData,
        wallets: walletsData,
      });
    } catch (error) {
      console.error('Error loading data:', error);
      // Fallback to AsyncStorage if Firebase fails
      const [
        customersData,
        suppliersData,
        agentsData,
        banksData,
        walletsData,
      ] = await Promise.all([
        AsyncStorage.getItem('customers'),
        AsyncStorage.getItem('suppliers'),
        AsyncStorage.getItem('agents'),
        AsyncStorage.getItem('banks'),
        AsyncStorage.getItem('wallets'),
      ]);

      setBalances({
        customers: customersData ? JSON.parse(customersData) : [],
        suppliers: suppliersData ? JSON.parse(suppliersData) : [],
        agents: agentsData ? JSON.parse(agentsData) : [],
        banks: banksData ? JSON.parse(banksData) : [],
        wallets: walletsData ? JSON.parse(walletsData) : [],
      });
    }
  };

  const calculateSummary = () => {
    const rate = parseFloat(usdRate) || 125;
    
    // Convert all balances to numbers properly
    const totalCustomersBDT = balances.customers.reduce((sum, c) => {
      const balance = typeof c.balance === 'string' ? parseFloat(c.balance) || 0 : c.balance || 0;
      return sum + balance;
    }, 0);
    
    const totalSuppliersBDT = balances.suppliers.reduce((sum, s) => {
      const balanceUSD = typeof s.balanceUSD === 'string' ? parseFloat(s.balanceUSD) || 0 : s.balanceUSD || 0;
      const supplierBalanceBDT = balanceUSD * rate;
      
      // For suppliers: Positive balance means you owe them (debt), so it's negative for you
      // Negative balance means they owe you (asset), so it's positive for you
      // Invert the sign for suppliers
      return sum - supplierBalanceBDT;
    }, 0);
    
    const totalAgentsBDT = balances.agents.reduce((sum, a) => {
      const balance = typeof a.balance === 'string' ? parseFloat(a.balance) || 0 : a.balance || 0;
      return sum + balance;
    }, 0);
    
    const totalBanksBDT = balances.banks.reduce((sum, b) => {
      const balance = typeof b.balance === 'string' ? parseFloat(b.balance) || 0 : b.balance || 0;
      return sum + balance;
    }, 0);
    
    const totalWalletsBDT = balances.wallets.reduce((sum, w) => {
      const balanceUSD = typeof w.balanceUSD === 'string' ? parseFloat(w.balanceUSD) || 0 : w.balanceUSD || 0;
      return sum + (balanceUSD * rate);
    }, 0);

    // Calculate total money (Your net worth)
    // NEW FORMULA: (customers + agents + banks + wallets) - suppliers
    const totalMoney = totalCustomersBDT + totalAgentsBDT + totalBanksBDT + totalWalletsBDT + totalSuppliersBDT;

    console.log('Calculation Details:', {
      customers: totalCustomersBDT,
      agents: totalAgentsBDT,
      banks: totalBanksBDT,
      wallets: totalWalletsBDT,
      suppliers: totalSuppliersBDT,
      total: totalMoney
    });

    setSummary({
      totalCustomersBDT,
      totalSuppliersBDT: -totalSuppliersBDT, // Display as positive for UI
      totalAgentsBDT,
      totalBanksBDT,
      totalWalletsBDT,
      totalMoney,
    });
  };

  // Fix the render function to handle negative suppliers correctly
  const renderBalanceRow = (label, amount, currency = 'BDT', isSupplier = false) => (
    <View style={styles.balanceRow}>
      <Text style={styles.balanceLabel}>{label}</Text>
      <Text style={[
        styles.balanceAmount,
        (isSupplier ? -amount : amount) > 0 ? styles.positiveBalance : 
        (isSupplier ? -amount : amount) < 0 ? styles.negativeBalance : styles.neutralBalance
      ]}>
        {currency === 'USD' ? formatUSD(isSupplier ? -amount : amount) : formatCurrency(isSupplier ? -amount : amount)}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}> Exchange App</Text>
      <TouchableOpacity 
        style={styles.reloadButton}
        onPress={loadAllData}
      >
        <Icon name="refresh" size={24} color="white" />
      </TouchableOpacity>
      
      {/* USD Rate Input */}
      <View style={styles.rateInputContainer}>
        <Text style={styles.rateLabel}>$ Rate (BDT per $):</Text>
        <TextInput
          style={styles.rateInput}
          value={usdRate}
          onChangeText={setUsdRate}
          keyboardType="numeric"
          placeholder="125"
        />
      </View>

      <ScrollView style={styles.scrollContainer}>
        {/* Customers Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👥 Customers</Text>
          {balances.customers.map(customer => {
            const balance = typeof customer.balance === 'string' ? parseFloat(customer.balance) || 0 : customer.balance || 0;
            return (
              <View key={customer.id} style={styles.itemRow}>
                <Text style={styles.itemName}>{customer.name}</Text>
                <Text style={[
                  styles.itemBalance,
                  balance > 0 ? styles.positiveBalance : 
                  balance < 0 ? styles.negativeBalance : styles.neutralBalance
                ]}>
                  {formatCurrency(balance)}
                </Text>
              </View>
            );
          })}
          {renderBalanceRow('Total Customers:', summary.totalCustomersBDT)}
        </View>

        {/* Suppliers Section - FIXED SIGN */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏢 Suppliers</Text>
          {balances.suppliers.map(supplier => {
            const balanceUSD = typeof supplier.balanceUSD === 'string' ? parseFloat(supplier.balanceUSD) || 0 : supplier.balanceUSD || 0;
            const rate = parseFloat(usdRate) || 125;
            const balanceBDT = balanceUSD * rate;
            
            // Display logic: Positive means supplier owes you, Negative means you owe supplier
            return (
              <View key={supplier.id} style={styles.itemRow}>
                <Text style={styles.itemName}>{supplier.name}</Text>
                <View style={styles.dualBalance}>
                  <Text style={styles.smallText}>{formatUSD(balanceUSD)}</Text>
                  <Text style={[
                    styles.itemBalance,
                    balanceUSD < 0 ? styles.positiveBalance :  // Supplier owes you (good)
                    balanceUSD > 0 ? styles.negativeBalance :  // You owe supplier (bad)
                    styles.neutralBalance
                  ]}>
                    {formatCurrency(-balanceBDT)}
                  </Text>
                </View>
              </View>
            );
          })}
          {renderBalanceRow('Total Suppliers:', summary.totalSuppliersBDT, 'BDT', true)}
        </View>

        {/* DHS Agents Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🤝 DHS Agents</Text>
          {balances.agents.map(agent => {
            const balance = typeof agent.balance === 'string' ? parseFloat(agent.balance) || 0 : agent.balance || 0;
            return (
              <View key={agent.id} style={styles.itemRow}>
                <Text style={styles.itemName}>{agent.name}</Text>
                <Text style={[
                  styles.itemBalance,
                  balance > 0 ? styles.positiveBalance : 
                  balance < 0 ? styles.negativeBalance : styles.neutralBalance
                ]}>
                  {formatCurrency(balance)}
                </Text>
              </View>
            );
          })}
          {renderBalanceRow('Total Agents:', summary.totalAgentsBDT)}
        </View>

        {/* Banks Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏦 Banks</Text>
          {balances.banks.map(bank => {
            const balance = typeof bank.balance === 'string' ? parseFloat(bank.balance) || 0 : bank.balance || 0;
            return (
              <View key={bank.id} style={styles.itemRow}>
                <Text style={styles.itemName}>{bank.name}</Text>
                <Text style={[
                  styles.itemBalance,
                  balance >= 0 ? styles.positiveBalance : styles.negativeBalance
                ]}>
                  {formatCurrency(balance)}
                </Text>
              </View>
            );
          })}
          {renderBalanceRow('Total Banks:', summary.totalBanksBDT)}
        </View>

        {/* USDT Wallets Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💳 USDT Wallets</Text>
          {balances.wallets.map(wallet => {
            const balanceUSD = typeof wallet.balanceUSD === 'string' ? parseFloat(wallet.balanceUSD) || 0 : wallet.balanceUSD || 0;
            const rate = parseFloat(usdRate) || 125;
            return (
              <View key={wallet.id} style={styles.itemRow}>
                <Text style={styles.itemName}>{wallet.name}</Text>
                <View style={styles.dualBalance}>
                  <Text style={styles.smallText}>{formatUSD(balanceUSD)}</Text>
                  <Text style={[
                    styles.itemBalance,
                    balanceUSD >= 0 ? styles.positiveBalance : styles.negativeBalance
                  ]}>
                    {formatCurrency(balanceUSD * rate)}
                  </Text>
                </View>
              </View>
            );
          })}
          {renderBalanceRow('Total Wallets:', summary.totalWalletsBDT)}
        </View>

        {/* Final Summary - FIXED CALCULATION */}
        <View style={[styles.section, styles.totalSection]}>
          <Text style={styles.totalTitle}>💰 YOUR TOTAL MONEY</Text>
          
          <View style={styles.calculationBreakdown}>
            <Text style={styles.calculationLine}>
              Customers: {formatCurrency(summary.totalCustomersBDT)}
            </Text>
            <Text style={styles.calculationLine}>
              Agents: {formatCurrency(summary.totalAgentsBDT)}
            </Text>
            <Text style={styles.calculationLine}>
              Banks: {formatCurrency(summary.totalBanksBDT)}
            </Text>
            <Text style={styles.calculationLine}>
              Wallets: {formatCurrency(summary.totalWalletsBDT)}
            </Text>
            <Text style={styles.calculationLine}>
              Suppliers: {formatCurrency(summary.totalSuppliersBDT)}
            </Text>
            <View style={styles.calculationDivider} />
            <Text style={styles.calculationTotal}>
              Total = {formatCurrency(summary.totalMoney)}
            </Text>
          </View>
          
          <Text style={[
            styles.totalAmount,
            summary.totalMoney > 0 ? styles.positiveBalance : 
            summary.totalMoney < 0 ? styles.negativeBalance : styles.neutralBalance
          ]}>
            {formatCurrency(summary.totalMoney)}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.navigationContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.navigationScroll}
        >
          <View style={styles.navigationButtons}>
            <TouchableOpacity 
              style={styles.navButton}
              onPress={() => navigation.navigate('Customers')}
            >
              <Icon name="people" size={20} color="white" />
              <Text style={styles.navButtonText}>Customers</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.navButton}
              onPress={() => navigation.navigate('Suppliers')}
            >
              <Icon name="business" size={20} color="white" />
              <Text style={styles.navButtonText}>Suppliers</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.navButton}
              onPress={() => navigation.navigate('Agents')}
            >
              <Icon name="account-balance" size={20} color="white" />
              <Text style={styles.navButtonText}>Agents</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.navButton}
              onPress={() => navigation.navigate('Banks')}
            >
              <Icon name="account-balance-wallet" size={20} color="white" />
              <Text style={styles.navButtonText}>Banks & wallets</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

// ==================== CUSTOMER MANAGEMENT ====================
const CustomersScreen = ({ navigation }) => {
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
};

// ==================== CUSTOMER DETAILS SCREEN (UPDATED) ====================
const CustomerDetailsScreen = ({ route, navigation }) => {
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
};
// ==================== SUPPLIERS SCREEN ====================
const SuppliersScreen = ({ navigation }) => {
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
};

// ==================== SUPPLIER DETAILS SCREEN ====================
const SupplierDetailsScreen = ({ route, navigation }) => {
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
};

// ==================== AGENTS SCREEN ====================
const AgentsScreen = ({ navigation }) => {
  const [agents, setAgents] = useState([]);
  const [filteredAgents, setFilteredAgents] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentAgent, setCurrentAgent] = useState({
    id: '',
    name: '',
    contact: '',
    balance: '0',
  });

  // Load agents from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'agents'), (snapshot) => {
      const agentsList = [];
      snapshot.forEach((doc) => {
        agentsList.push({ id: doc.id, ...doc.data() });
      });
      // Sort by updatedAt (newest first)
      agentsList.sort((a, b) => {
        const dateA = a.updatedAt ? new Date(a.updatedAt) : new Date(a.createdAt || 0);
        const dateB = b.updatedAt ? new Date(b.updatedAt) : new Date(b.createdAt || 0);
        return dateB - dateA;
      });
      setAgents(agentsList);
      setFilteredAgents(agentsList);
      // Also save to AsyncStorage for offline backup
      AsyncStorage.setItem('agents', JSON.stringify(agentsList));
    }, (error) => {
      console.error("Firestore error:", error);
      // Fallback to AsyncStorage
      loadAgentsFromStorage();
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Filter agents based on search query
    if (searchQuery.trim() === '') {
      setFilteredAgents(agents);
    } else {
      const filtered = agents.filter(agent =>
        agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (agent.contact && agent.contact.includes(searchQuery))
      );
      setFilteredAgents(filtered);
    }
  }, [searchQuery, agents]);

  const loadAgentsFromStorage = async () => {
    try {
      const storedAgents = await AsyncStorage.getItem('agents');
      if (storedAgents) {
        const agentsList = JSON.parse(storedAgents);
        // Sort by updatedAt (newest first)
        agentsList.sort((a, b) => {
          const dateA = a.updatedAt ? new Date(a.updatedAt) : new Date(a.createdAt || 0);
          const dateB = b.updatedAt ? new Date(b.updatedAt) : new Date(b.createdAt || 0);
          return dateB - dateA;
        });
        setAgents(agentsList);
        setFilteredAgents(agentsList);
      }
    } catch (error) {
      console.error('Error loading agents:', error);
    }
  };

  const saveAgent = async () => {
    if (!currentAgent.name.trim()) {
      Alert.alert('Error', 'Agent name is required');
      return;
    }

    try {
      const agentData = {
        name: currentAgent.name.trim(),
        contact: currentAgent.contact?.trim() || '',
        balance: parseFloat(currentAgent.balance) || 0,
        updatedAt: getTodayDate(),
      };

      // Only add createdAt for new agents
      if (!currentAgent.id) {
        agentData.createdAt = getTodayDate();
      }

      // UPDATE UI IMMEDIATELY
      let updatedAgents;
      if (currentAgent.id) {
        // Update in local state immediately
        updatedAgents = agents.map(a => 
          a.id === currentAgent.id ? { 
            ...a, 
            ...agentData,
            id: currentAgent.id
          } : a
        );
      } else {
        // Add to local state immediately with temporary ID
        const tempId = `temp_${Date.now()}`;
        const newAgent = {
          ...agentData,
          id: tempId,
        };
        updatedAgents = [newAgent, ...agents];
      }

      // Update state immediately
      setAgents(updatedAgents);
      setFilteredAgents(updatedAgents);
      await AsyncStorage.setItem('agents', JSON.stringify(updatedAgents));

      // Now save to Firestore in background
      if (currentAgent.id) {
        // Update existing agent in Firestore
        const updateData = { ...agentData };
        delete updateData.createdAt; // Remove createdAt for updates
        
        await updateDoc(doc(db, 'agents', currentAgent.id), updateData);
        
        Alert.alert('Success', 'Agent updated in cloud!');
      } else {
        // Add new agent to Firestore
        const docRef = await addDoc(collection(db, 'agents'), agentData);
        const newAgent = { id: docRef.id, ...agentData };
        
        // Replace temporary ID with real Firestore ID
        const finalAgents = updatedAgents.map(a => 
          a.id.startsWith('temp_') ? newAgent : a
        );
        
        // Update with real ID
        setAgents(finalAgents);
        setFilteredAgents(finalAgents);
        await AsyncStorage.setItem('agents', JSON.stringify(finalAgents));
        
        Alert.alert('Success', 'Agent saved to cloud!');
      }

      // Reset and close modal
      setModalVisible(false);
      setCurrentAgent({ id: '', name: '', contact: '', balance: '0' });
      
    } catch (error) {
      console.error('Error saving agent:', error);
      
      // Revert to original state if Firestore fails
      loadAgentsFromStorage();
      
      Alert.alert('Error', `Failed to save to cloud: ${error.message}`);
      
      // Still keep local changes
      setModalVisible(false);
      setCurrentAgent({ id: '', name: '', contact: '', balance: '0' });
      Alert.alert('Saved locally', 'Agent saved to device storage');
    }
  };

  const deleteAgent = (agentId) => {
    Alert.alert(
      'Delete Agent',
      'Are you sure you want to delete this agent? All transactions will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete from Firestore
              await deleteDoc(doc(db, 'agents', agentId));
              
              // Delete from AsyncStorage
              const updatedAgents = agents.filter(a => a.id !== agentId);
              setAgents(updatedAgents);
              setFilteredAgents(updatedAgents);
              await AsyncStorage.setItem('agents', JSON.stringify(updatedAgents));
              
              // Delete associated transactions from AsyncStorage
              await AsyncStorage.removeItem(`agent_transactions_${agentId}`);
              
              Alert.alert('Success', 'Agent deleted from cloud!');
            } catch (error) {
              console.error('Error deleting agent:', error);
              // Fallback to AsyncStorage
              const updatedAgents = agents.filter(a => a.id !== agentId);
              setAgents(updatedAgents);
              setFilteredAgents(updatedAgents);
              await AsyncStorage.setItem('agents', JSON.stringify(updatedAgents));
              Alert.alert('Deleted locally', 'Agent deleted from device storage');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>🤝 DHS Agent Management</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => {
            setCurrentAgent({ id: '', name: '', contact: '', balance: '0' });
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
          placeholder="Search agents by name or contact..."
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

      {/* Agent Count */}
      <View style={styles.customerCountContainer}>
        <Text style={styles.customerCountText}>
          {filteredAgents.length} agent{filteredAgents.length !== 1 ? 's' : ''}
          {searchQuery ? ` found for "${searchQuery}"` : ''}
        </Text>
        <Text style={styles.sortText}>Sorted by: Last Updated</Text>
      </View>

      <FlatList
        data={filteredAgents}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <TouchableOpacity 
            style={styles.listCard}
            onPress={() => navigation.navigate('AgentDetails', { agent: item })}
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
                    setCurrentAgent(item);
                    setModalVisible(true);
                  }}
                >
                  <Icon name="edit" size={18} color="#007AFF" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => deleteAgent(item.id)}
                >
                  <Icon name="delete" size={18} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            </View>
            
            {item.contact ? (
              <View style={styles.phoneContainer}>
                <Icon name="phone" size={14} color="#666" />
                <Text style={styles.listCardText}> {item.contact}</Text>
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
                  {item.balance > 0 ? 'You owe agent' : 
                   item.balance < 0 ? 'Agent owes you' : 'Settled'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="account-balance" size={64} color="#ccc" />
            <Text style={styles.emptyStateText}>
              {searchQuery ? 'No agents found' : 'No agents yet'}
            </Text>
            <Text style={styles.emptyStateSubtext}>
              {searchQuery ? 'Try a different search term' : 'Add your first DHS agent'}
            </Text>
          </View>
        }
      />

      {/* Add/Edit Agent Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {currentAgent.id ? '✏️ Edit Agent' : '🤝 Add New Agent'}
            </Text>
            
            <TextInput
              style={styles.input}
              placeholder="Agent Name *"
              value={currentAgent.name}
              onChangeText={(text) => setCurrentAgent({...currentAgent, name: text})}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Contact (Optional)"
              value={currentAgent.contact}
              onChangeText={(text) => setCurrentAgent({...currentAgent, contact: text})}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Balance (BDT)"
              value={currentAgent.balance}
              onChangeText={(text) => setCurrentAgent({...currentAgent, balance: text})}
              keyboardType="numeric"
            />
            
            {currentAgent.balance && (
              <View style={styles.balancePreview}>
                <Text style={styles.balancePreviewText}>
                  Balance: {formatCurrency(parseFloat(currentAgent.balance) || 0)}
                </Text>
                <Text style={[
                  styles.balancePreviewStatus,
                  parseFloat(currentAgent.balance) > 0 ? styles.positiveBalance : 
                  parseFloat(currentAgent.balance) < 0 ? styles.negativeBalance : styles.neutralBalance
                ]}>
                  {parseFloat(currentAgent.balance) > 0 ? 'You will owe agent' : 
                   parseFloat(currentAgent.balance) < 0 ? 'Agent will owe you' : 'Settled'}
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
                onPress={saveAgent}
              >
                <Text style={styles.modalButtonText}>
                  {currentAgent.id ? 'Update' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ==================== AGENT DETAILS SCREEN (CORRECTED) ====================
const AgentDetailsScreen = ({ route, navigation }) => {
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
};

// ==================== BANKS & WALLETS SCREEN ====================
const BanksScreen = ({ navigation }) => {
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
};

// ==================== BANK/WALLET DETAILS SCREEN ====================
const BankWalletDetailsScreen = ({ route, navigation }) => {
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
};

// ==================== MAIN APP ====================
const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Dashboard"
        screenOptions={{
          headerStyle: { backgroundColor: '#007AFF' },
          headerTintColor: 'white',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="Customers" component={CustomersScreen} />
        <Stack.Screen name="CustomerDetails" component={CustomerDetailsScreen} />
        <Stack.Screen name="Suppliers" component={SuppliersScreen} />
        <Stack.Screen name="SupplierDetails" component={SupplierDetailsScreen} />
        <Stack.Screen name="Agents" component={AgentsScreen} />
        <Stack.Screen 
          name="AgentDetails" 
          component={AgentDetailsScreen} 
          options={{ title: 'Agent Details' }}
        />
        <Stack.Screen name="Banks" component={BanksScreen} />
        <Stack.Screen 
          name="BankWalletDetails" 
          component={BankWalletDetailsScreen}
          options={({ route }) => ({ 
            title: route.params.type === 'bank' ? 'Bank Details' : 'Wallet Details'
          })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
} 

// ==================== STYLES ====================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 10,
    color: '#333',
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  
  // Dashboard Styles
  rateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 15,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  rateLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 10,
    color: '#333',
  },
  rateInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 8,
    fontSize: 16,
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemName: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  itemBalance: {
    fontSize: 14,
    fontWeight: '600',
  },
  dualBalance: {
    alignItems: 'flex-end',
  },
  smallText: {
    fontSize: 12,
    color: '#666',
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    marginTop: 5,
  },
  balanceLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalSection: {
    backgroundColor: '#e3f2fd',
    borderWidth: 2,
    borderColor: '#2196f3',
  },
  totalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1976d2',
    marginBottom: 5,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  totalSubtext: {
    fontSize: 12,
    textAlign: 'center',
    color: '#666',
  },
  navigationButtons: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  navButtonText: {
    color: '#007AFF',
    fontSize: 12,
    marginTop: 4,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  addButton: {
    backgroundColor: '#007AFF',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallAddButton: {
    backgroundColor: '#007AFF',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // List Cards
  listCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  listCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  listCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  listCardText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  listCardActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
  },
  balanceText: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 8,
  },
  supplierType: {
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    fontWeight: '600',
  },
  rmbType: {
    backgroundColor: '#d1ecf1',
    color: '#0c5460',
  },
  usdtType: {
    backgroundColor: '#d4edda',
    color: '#155724',
  },
  
  // Customer Details
  customerHeader: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  customerName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  customerContact: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  balanceCard: {
    marginTop: 15,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  balanceOwe: {
    backgroundColor: '#f8d7da',
    borderColor: '#f5c6cb',
  },
  balanceReceive: {
    backgroundColor: '#d4edda',
    borderColor: '#c3e6cb',
  },
  balanceNeutral: {
    backgroundColor: '#f8f9fa',
    borderColor: '#e9ecef',
  },
  balanceTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
  },
  balanceAmount: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  
  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  actionButtonLarge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  orderButton: {
    backgroundColor: '#28a745',
  },
  paymentButton: {
    backgroundColor: '#007AFF',
  },
  billButton: {
    backgroundColor: '#ff9800',
  },
  dhsButton: {
    backgroundColor: '#9c27b0',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  
  // Transaction History
  transactionList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  transactionCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  transactionType: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  transactionDate: {
    fontSize: 12,
    color: '#666',
  },
  transactionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  boldText: {
    fontWeight: 'bold',
  },
  smallText: {
    fontSize: 12,
    color: '#666',
  },
  notesText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
  },
  transactionTime: {
    fontSize: 11,
    color: '#999',
    marginTop: 8,
    textAlign: 'right',
  },
  
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  input: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  radioGroup: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  radioButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#dee2e6',
  },
  radioButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  radioButtonText: {
    fontSize: 14,
    color: '#495057',
  },
  radioButtonTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  calculationBox: {
    backgroundColor: '#e7f3ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
  },
  calculationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0056b3',
  },
  calculationFormula: {
    fontSize: 12,
    color: '#0056b3',
    marginTop: 4,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#6c757d',
  },
  saveButton: {
    backgroundColor: '#28a745',
  },
  modalButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  
  // Sub Sections
  subSection: {
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  subSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  subSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  
  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  
  // No Data
  noDataText: {
    textAlign: 'center',
    color: '#6c757d',
    fontStyle: 'italic',
    marginTop: 20,
    marginBottom: 20,
  },
  
  // Text Colors
  positiveBalance: {
    color: '#dc3545', // Red = You owe them
  },
  negativeBalance: {
    color: '#28a745', // Green = They owe you
  },
  neutralBalance: {
    color: '#6c757d', // Gray = Settled
  },
  reloadButton: {
    position: 'absolute',
    bottom: 70,
    right: 16,
    backgroundColor: '#007AFF',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  balanceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  actionButtonsSmall: {
    flexDirection: 'row',
  },
  smallActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  depositButton: {
    backgroundColor: '#28a745',
  },
  withdrawButton: {
    backgroundColor: '#dc3545',
  },
  smallActionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  currentBalance: {
    fontSize: 14,
    marginBottom: 5,
    color: '#333',
  },
  dhsBalanceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.3)',
  },
  dhsBalanceLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  dhsBalanceAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  conversionContainer: {
    marginTop: 5,
  },
  conversionText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  calculationBreakdown: {
    marginVertical: 15,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
  },
  calculationLine: {
    fontSize: 12,
    color: '#666',
    marginBottom: 3,
  },
  calculationDivider: {
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 8,
  },
  calculationTotal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  navigationContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingVertical: 6,
  },
  navigationScroll: {
    flexGrow: 0,
    height: 60,
  },
  navigationButtons: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  navButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    backgroundColor: '#007AFF',
    borderRadius: 20,
    minWidth: 70,
    flexDirection: 'row',
  },
  navButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  // Supplier Details
  supplierHeader: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  supplierName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  supplierContact: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  // Agent Details
  agentHeader: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  agentName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  agentContact: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
   transactionActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  smallEditButton: {
    padding: 6,
    marginLeft: 8,
    backgroundColor: '#e3f2fd',
    borderRadius: 4,
  },
  smallDeleteButton: {
    padding: 6,
    marginLeft: 4,
    backgroundColor: '#ffebee',
    borderRadius: 4,
  },
// Bank/Wallet Details Styles
detailsHeader: {
  backgroundColor: '#007AFF',
  padding: 20,
  borderBottomLeftRadius: 20,
  borderBottomRightRadius: 20,
  marginBottom: 15,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.2,
  shadowRadius: 5,
  elevation: 5,
},
bankHeader: {
  backgroundColor: '#007AFF',
},
walletHeader: {
  backgroundColor: '#9c27b0',
},
headerContent: {
  marginBottom: 15,
},
detailsName: {
  fontSize: 24,
  fontWeight: 'bold',
  color: 'white',
  marginBottom: 10,
},
infoRow: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 5,
},
detailsInfo: {
  fontSize: 14,
  color: 'rgba(255,255,255,0.9)',
  marginLeft: 8,
},
balanceCard: {
  backgroundColor: 'rgba(255,255,255,0.2)',
  padding: 15,
  borderRadius: 12,
  alignItems: 'center',
  borderWidth: 2,
  borderColor: 'rgba(255,255,255,0.3)',
},
balancePositive: {
  borderColor: 'rgba(76, 217, 100, 0.5)',
},
balanceNegative: {
  borderColor: 'rgba(255, 59, 48, 0.5)',
},
balanceLabel: {
  fontSize: 14,
  color: 'rgba(255,255,255,0.9)',
  marginBottom: 5,
},
balanceValue: {
  fontSize: 28,
  fontWeight: 'bold',
  color: 'white',
  marginBottom: 8,
},
balanceBadge: {
  backgroundColor: 'rgba(255,255,255,0.2)',
  paddingHorizontal: 12,
  paddingVertical: 4,
  borderRadius: 20,
},
balanceBadgeText: {
  fontSize: 12,
  fontWeight: '600',
  color: 'white',
},

// Action Buttons
detailsActionButtons: {
  flexDirection: 'row',
  paddingHorizontal: 16,
  marginBottom: 20,
},
detailsActionButton: {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 12,
  borderRadius: 10,
  marginHorizontal: 4,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 3,
  elevation: 3,
},
depositActionButton: {
  backgroundColor: '#28a745',
},
withdrawActionButton: {
  backgroundColor: '#dc3545',
},
editActionButton: {
  backgroundColor: '#007AFF',
},
detailsActionButtonText: {
  color: 'white',
  fontSize: 14,
  fontWeight: '600',
  marginLeft: 6,
},

// Transaction Section
transactionSection: {
  flex: 1,
  paddingHorizontal: 16,
},
sectionHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 15,
},
transactionCount: {
  fontSize: 12,
  color: '#6c757d',
  backgroundColor: '#f8f9fa',
  paddingHorizontal: 10,
  paddingVertical: 4,
  borderRadius: 12,
},

// Transaction Cards
transactionCard: {
  backgroundColor: 'white',
  padding: 15,
  borderRadius: 12,
  marginBottom: 10,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.1,
  shadowRadius: 2,
  elevation: 2,
  borderLeftWidth: 4,
},
depositCard: {
  borderLeftColor: '#28a745',
},
withdrawCard: {
  borderLeftColor: '#dc3545',
},
transactionHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 10,
},
transactionTypeContainer: {
  flexDirection: 'row',
  alignItems: 'center',
},
transactionIcon: {
  width: 32,
  height: 32,
  borderRadius: 16,
  justifyContent: 'center',
  alignItems: 'center',
  marginRight: 10,
},
depositIcon: {
  backgroundColor: '#28a745',
},
withdrawIcon: {
  backgroundColor: '#dc3545',
},
transactionType: {
  fontSize: 14,
  fontWeight: 'bold',
  color: '#333',
},
transactionDate: {
  fontSize: 12,
  color: '#6c757d',
  marginTop: 2,
},
transactionAmount: {
  fontSize: 18,
  fontWeight: 'bold',
},
depositAmount: {
  color: '#28a745',
},
withdrawAmount: {
  color: '#dc3545',
},
transactionDetails: {
  marginBottom: 8,
},
transactionBalance: {
  fontSize: 14,
  color: '#333',
  marginBottom: 4,
},
transactionDescription: {
  fontSize: 12,
  color: '#6c757d',
  fontStyle: 'italic',
},
transactionTime: {
  fontSize: 11,
  color: '#999',
  textAlign: 'right',
},

// Empty State
emptyTransactionState: {
  alignItems: 'center',
  justifyContent: 'center',
  padding: 40,
},
emptyTransactionText: {
  fontSize: 16,
  color: '#6c757d',
  marginTop: 16,
  marginBottom: 8,
},
emptyTransactionSubtext: {
  fontSize: 14,
  color: '#adb5bd',
  textAlign: 'center',
},

// Modal Styles
modalInfo: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#e7f3ff',
  padding: 12,
  borderRadius: 8,
  marginBottom: 15,
},
modalInfoText: {
  fontSize: 16,
  fontWeight: '600',
  color: '#007AFF',
  marginLeft: 10,
},
depositText: {
  color: '#28a745',
},
withdrawText: {
  color: '#dc3545',
},
calculationDivider: {
  height: 1,
  backgroundColor: '#dee2e6',
  marginVertical: 8,
},
// Search Styles
searchContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: 'white',
  marginHorizontal: 16,
  marginVertical: 10,
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: '#ddd',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.1,
  shadowRadius: 2,
  elevation: 2,
},
searchIcon: {
  marginRight: 8,
},
searchInput: {
  flex: 1,
  fontSize: 14,
  paddingVertical: 4,
},
clearSearchButton: {
  padding: 4,
},

// Customer Count
customerCountContainer: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingHorizontal: 16,
  marginBottom: 10,
},
customerCountText: {
  fontSize: 12,
  color: '#666',
  fontWeight: '500',
},
sortText: {
  fontSize: 10,
  color: '#999',
  fontStyle: 'italic',
},

// Customer Card Styles
customerInfo: {
  flexDirection: 'row',
  alignItems: 'center',
  flex: 1,
},
customerIndex: {
  fontSize: 12,
  fontWeight: 'bold',
  color: '#007AFF',
  backgroundColor: '#e7f3ff',
  width: 24,
  height: 24,
  borderRadius: 12,
  textAlign: 'center',
  lineHeight: 24,
  marginRight: 10,
},
customerDate: {
  fontSize: 10,
  color: '#999',
  marginTop: 2,
},
phoneContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  marginTop: 6,
  marginBottom: 8,
},
balanceContainer: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: 8,
  paddingTop: 8,
  borderTopWidth: 1,
  borderTopColor: '#f0f0f0',
},
balanceStatus: {
  paddingHorizontal: 8,
  paddingVertical: 2,
  borderRadius: 4,
  backgroundColor: '#f8f9fa',
},
balanceStatusText: {
  fontSize: 10,
  fontWeight: '600',
},
positiveStatus: {
  color: '#dc3545',
},
negativeStatus: {
  color: '#28a745',
},
neutralStatus: {
  color: '#6c757d',
},

// Modal Balance Preview
balancePreview: {
  backgroundColor: '#f8f9fa',
  padding: 10,
  borderRadius: 8,
  marginBottom: 15,
  alignItems: 'center',
},
balancePreviewText: {
  fontSize: 16,
  fontWeight: '600',
  marginBottom: 4,
},
balancePreviewStatus: {
  fontSize: 12,
  fontWeight: '500',
},
// Customer Details Styles
transactionHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingHorizontal: 16,
  marginBottom: 10,
},
refreshButton: {
  padding: 8,
},
transactionCount: {
  fontSize: 12,
  color: 'rgba(255,255,255,0.8)',
  marginTop: 5,
  textAlign: 'center',
},

// Transaction Card Styles
transactionHeaderRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 8,
},
transactionTypeBadge: {
  flexDirection: 'row',
  alignItems: 'center',
},
transactionTypeText: {
  fontSize: 12,
  fontWeight: 'bold',
  backgroundColor: '#e7f3ff',
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 4,
  color: '#007AFF',
  marginRight: 8,
},
transactionIndex: {
  fontSize: 11,
  color: '#666',
  backgroundColor: '#f8f9fa',
  paddingHorizontal: 6,
  paddingVertical: 2,
  borderRadius: 3,
},
transactionActions: {
  flexDirection: 'row',
},
transactionDate: {
  fontSize: 12,
  color: '#666',
  marginBottom: 10,
},
transactionDetails: {
  marginBottom: 8,
},
transactionRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  marginBottom: 4,
},
transactionLabel: {
  fontSize: 14,
  color: '#666',
},
transactionValue: {
  fontSize: 14,
  color: '#333',
  fontWeight: '500',
},
notesContainer: {
  marginTop: 8,
  padding: 8,
  backgroundColor: '#f8f9fa',
  borderRadius: 6,
  borderLeftWidth: 3,
  borderLeftColor: '#007AFF',
},
notesLabel: {
  fontSize: 12,
  color: '#666',
  fontWeight: '600',
  marginBottom: 2,
},
notesText: {
  fontSize: 13,
  color: '#333',
},
transactionTime: {
  fontSize: 11,
  color: '#999',
  textAlign: 'right',
  marginTop: 6,
},

// Empty Transaction State
emptyTransactionState: {
  alignItems: 'center',
  justifyContent: 'center',
  padding: 40,
},
emptyTransactionText: {
  fontSize: 16,
  color: '#6c757d',
  marginTop: 16,
  marginBottom: 8,
},
emptyTransactionSubtext: {
  fontSize: 14,
  color: '#adb5bd',
  textAlign: 'center',
},
// Banks/Wallets Screen Styles
refreshButton: {
  padding: 8,
},
subSectionActions: {
  flexDirection: 'row',
  alignItems: 'center',
},
itemCount: {
  fontSize: 12,
  color: '#666',
  marginBottom: 10,
  paddingHorizontal: 4,
},
itemInfo: {
  flexDirection: 'row',
  alignItems: 'center',
  flex: 1,
},
itemIndex: {
  fontSize: 12,
  fontWeight: 'bold',
  color: '#007AFF',
  backgroundColor: '#e7f3ff',
  width: 24,
  height: 24,
  borderRadius: 12,
  textAlign: 'center',
  lineHeight: 24,
  marginRight: 10,
},
itemDate: {
  fontSize: 10,
  color: '#999',
  marginTop: 2,
},
infoContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  marginTop: 6,
  marginBottom: 8,
},

// Details Screen Styles
refreshActionButton: {
  backgroundColor: '#6c757d',
},
sortText: {
  fontSize: 10,
  color: '#999',
  fontStyle: 'italic',
},
transactionFooter: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: 8,
  paddingTop: 8,
  borderTopWidth: 1,
  borderTopColor: 'rgba(0,0,0,0.05)',
},
});