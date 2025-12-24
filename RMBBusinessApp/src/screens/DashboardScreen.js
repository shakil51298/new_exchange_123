// src/screens/DashboardScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, getDocs } from 'firebase/firestore';

import { db } from '../config/firebase';
import styles from '../styles/styles';

import { formatCurrency, formatUSD } from '../utils/format';

export default function DashboardScreen({ navigation }) {
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
}