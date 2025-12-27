// src/screens/DashboardScreen.js
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, getDocs } from 'firebase/firestore';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

import { db } from '../config/firebase';
import styles from '../styles/styles';
import { formatCurrency, formatUSD } from '../utils/format';

const USD_RATE_KEY = 'dashboard_usd_rate_v3';

export default function DashboardScreen({ navigation }) {
  const [usdRate, setUsdRate] = useState('');
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

  const [refreshing, setRefreshing] = useState(false);

  // ✅ Dashboard-only smaller text
  const ui = useMemo(
    () => ({
      title: { fontSize: 16, fontWeight: '800' },
      sectionTitle: { fontSize: 13, fontWeight: '800' },
      rowName: { fontSize: 12, fontWeight: '600' },
      rowValue: { fontSize: 12, fontWeight: '900' },
      tiny: { fontSize: 10, color: '#6b7280' },
      totalTitle: { fontSize: 13, fontWeight: '900' },
      totalAmount: { fontSize: 16, fontWeight: '900' },
    }),
    []
  );

  // ✅ Load persisted USD rate once
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(USD_RATE_KEY);
        if (saved && String(saved).trim()) {
          setUsdRate(String(saved));
        } else {
          setUsdRate('125'); // first time only
          await AsyncStorage.setItem(USD_RATE_KEY, '125');
        }
      } catch {
        setUsdRate('125');
      }
    })();
  }, []);

  // ✅ Persist USD rate always
  useEffect(() => {
    const v = String(usdRate || '').trim();
    if (!v) return;
    AsyncStorage.setItem(USD_RATE_KEY, v).catch(() => {});
  }, [usdRate]);

  const loadAllData = useCallback(async () => {
    try {
      const [customers, suppliers, agents, banks, wallets] = await Promise.all([
        getDocs(collection(db, 'customers')),
        getDocs(collection(db, 'suppliers')),
        getDocs(collection(db, 'agents')),
        getDocs(collection(db, 'banks')),
        getDocs(collection(db, 'wallets')),
      ]);

      const data = {
        customers: customers.docs.map((d) => ({ id: d.id, ...d.data() })),
        suppliers: suppliers.docs.map((d) => ({ id: d.id, ...d.data() })),
        agents: agents.docs.map((d) => ({ id: d.id, ...d.data() })),
        banks: banks.docs.map((d) => ({ id: d.id, ...d.data() })),
        wallets: wallets.docs.map((d) => ({ id: d.id, ...d.data() })),
      };

      setBalances(data);

      // Optional offline cache (if you already use it elsewhere)
      AsyncStorage.setItem('customers', JSON.stringify(data.customers)).catch(() => {});
      AsyncStorage.setItem('suppliers', JSON.stringify(data.suppliers)).catch(() => {});
      AsyncStorage.setItem('agents', JSON.stringify(data.agents)).catch(() => {});
      AsyncStorage.setItem('banks', JSON.stringify(data.banks)).catch(() => {});
      AsyncStorage.setItem('wallets', JSON.stringify(data.wallets)).catch(() => {});
    } catch (e) {
      console.error('Dashboard load failed:', e);

      // fallback from AsyncStorage
      const [c, s, a, b, w] = await Promise.all([
        AsyncStorage.getItem('customers'),
        AsyncStorage.getItem('suppliers'),
        AsyncStorage.getItem('agents'),
        AsyncStorage.getItem('banks'),
        AsyncStorage.getItem('wallets'),
      ]);

      setBalances({
        customers: c ? JSON.parse(c) : [],
        suppliers: s ? JSON.parse(s) : [],
        agents: a ? JSON.parse(a) : [],
        banks: b ? JSON.parse(b) : [],
        wallets: w ? JSON.parse(w) : [],
      });
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const calculateSummary = useCallback(() => {
    const rate = parseFloat(usdRate) || 125;

    const totalCustomersBDT = (balances.customers || []).reduce(
      (sum, c) => sum + (parseFloat(c.balance) || 0),
      0
    );

    const totalSuppliersBDT = (balances.suppliers || []).reduce(
      (sum, s) => sum + (parseFloat(s.balanceUSD) || 0) * rate,
      0
    );

    const totalAgentsBDT = (balances.agents || []).reduce(
      (sum, a) => sum + (parseFloat(a.balance) || 0),
      0
    );

    const totalBanksBDT = (balances.banks || []).reduce(
      (sum, b) => sum + (parseFloat(b.balance) || 0),
      0
    );

    const totalWalletsBDT = (balances.wallets || []).reduce(
      (sum, w) => sum + (parseFloat(w.balanceUSD) || 0) * rate,
      0
    );

    const totalMoney =
      totalCustomersBDT + totalAgentsBDT + totalBanksBDT + totalWalletsBDT - totalSuppliersBDT;

    setSummary({
      totalCustomersBDT,
      totalSuppliersBDT,
      totalAgentsBDT,
      totalBanksBDT,
      totalWalletsBDT,
      totalMoney,
    });
  }, [balances, usdRate]);

  useEffect(() => {
    calculateSummary();
  }, [calculateSummary]);

  // ✅ Pull-to-refresh (top to bottom reload)
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadAllData();
    } finally {
      setRefreshing(false);
    }
  }, [loadAllData]);

  // ✅ Small icon-only nav
  const IconBtn = ({ icon, color, onPress }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
      }}
    >
      <Icon name={icon} size={22} color={color} />
    </TouchableOpacity>
  );

  // ✅ Use FlatList as container so RefreshControl works properly
  return (
    <View style={styles.container}>
      <FlatList
        data={[]}
        renderItem={null}
        keyExtractor={() => 'dashboard'}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 90 }}
        ListHeaderComponent={
          <>
            {/* Header */}
            <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 }}>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
                <View style={[styles.rateInputContainer, { flex: 1, marginTop: 0 }]}>
                  <Text style={[styles.rateLabel, { fontSize: 12, fontWeight: '800' }]}>USD</Text>
                  <TextInput
                    style={[styles.rateInput, { fontSize: 12, paddingVertical: 6 }]}
                    value={usdRate}
                    onChangeText={setUsdRate}
                    keyboardType="numeric"
                    placeholder="125"
                  />
                </View>
              </View>
            </View>

            {/* Content */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, ui.sectionTitle]}>Customers</Text>
              {(balances.customers || []).map((c) => {
                const bal = parseFloat(c.balance) || 0;
                return (
                  <View key={c.id} style={styles.itemRow}>
                    <Text style={[styles.itemName, ui.rowName]}>{c.name}</Text>
                    <Text
                      style={[
                        styles.itemBalance,
                        ui.rowValue,
                        bal > 0 ? styles.positiveBalance : bal < 0 ? styles.negativeBalance : styles.neutralBalance,
                      ]}
                    >
                      {formatCurrency(bal)}
                    </Text>
                  </View>
                );
              })}
              <Text style={ui.tiny}>Total: {formatCurrency(summary.totalCustomersBDT)}</Text>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, ui.sectionTitle]}>Suppliers</Text>
              {(balances.suppliers || []).map((s) => {
                const usd = parseFloat(s.balanceUSD) || 0;
                const rate = parseFloat(usdRate) || 125;
                const bdt = usd * rate;

                return (
                  <View key={s.id} style={styles.itemRow}>
                    <Text style={[styles.itemName, ui.rowName]}>{s.name}</Text>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={ui.tiny}>{formatUSD(usd)}</Text>
                      <Text
                        style={[
                          styles.itemBalance,
                          ui.rowValue,
                          usd > 0 ? styles.negativeBalance : usd < 0 ? styles.positiveBalance : styles.neutralBalance,
                        ]}
                      >
                        {formatCurrency(-bdt)}
                      </Text>
                    </View>
                  </View>
                );
              })}
              <Text style={ui.tiny}>Total: {formatCurrency(summary.totalSuppliersBDT)}</Text>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, ui.sectionTitle]}>Agents</Text>
              {(balances.agents || []).map((a) => {
                const bal = parseFloat(a.balance) || 0;
                return (
                  <View key={a.id} style={styles.itemRow}>
                    <Text style={[styles.itemName, ui.rowName]}>{a.name}</Text>
                    <Text
                      style={[
                        styles.itemBalance,
                        ui.rowValue,
                        bal > 0 ? styles.positiveBalance : bal < 0 ? styles.negativeBalance : styles.neutralBalance,
                      ]}
                    >
                      {formatCurrency(bal)}
                    </Text>
                  </View>
                );
              })}
              <Text style={ui.tiny}>Total: {formatCurrency(summary.totalAgentsBDT)}</Text>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, ui.sectionTitle]}>Banks</Text>
              {(balances.banks || []).map((b) => {
                const bal = parseFloat(b.balance) || 0;
                return (
                  <View key={b.id} style={styles.itemRow}>
                    <Text style={[styles.itemName, ui.rowName]}>{b.name}</Text>
                    <Text
                      style={[
                        styles.itemBalance,
                        ui.rowValue,
                        bal >= 0 ? styles.positiveBalance : styles.negativeBalance,
                      ]}
                    >
                      {formatCurrency(bal)}
                    </Text>
                  </View>
                );
              })}
              <Text style={ui.tiny}>Total: {formatCurrency(summary.totalBanksBDT)}</Text>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, ui.sectionTitle]}>Wallets</Text>
              {(balances.wallets || []).map((w) => {
                const usd = parseFloat(w.balanceUSD) || 0;
                const rate = parseFloat(usdRate) || 125;
                const bdt = usd * rate;

                return (
                  <View key={w.id} style={styles.itemRow}>
                    <Text style={[styles.itemName, ui.rowName]}>{w.name}</Text>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={ui.tiny}>{formatUSD(usd)}</Text>
                      <Text
                        style={[
                          styles.itemBalance,
                          ui.rowValue,
                          usd >= 0 ? styles.positiveBalance : styles.negativeBalance,
                        ]}
                      >
                        {formatCurrency(bdt)}
                      </Text>
                    </View>
                  </View>
                );
              })}
              <Text style={ui.tiny}>Total: {formatCurrency(summary.totalWalletsBDT)}</Text>
            </View>

            <View style={[styles.section, styles.totalSection]}>
              <Text style={[styles.totalTitle, ui.totalTitle]}>TOTAL</Text>
              <Text
                style={[
                  styles.totalAmount,
                  ui.totalAmount,
                  summary.totalMoney >= 0 ? styles.positiveBalance : styles.negativeBalance,
                ]}
              >
                {formatCurrency(summary.totalMoney)}
              </Text>
            </View>
          </>
        }
      />

      {/* ✅ Small icon-only navigation */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 14,
          paddingVertical: 10,
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: 'rgba(0,0,0,0.08)',
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <IconBtn icon="account-group" color="#0A84FF" onPress={() => navigation.navigate('Customers')} />
          <IconBtn icon="truck-delivery" color="#FF9500" onPress={() => navigation.navigate('Suppliers')} />
          <IconBtn icon="account-tie" color="#34C759" onPress={() => navigation.navigate('Agents')} />
          <IconBtn icon="bank" color="#AF52DE" onPress={() => navigation.navigate('Banks')} />
        </View>
      </View>
    </View>
  );
}
