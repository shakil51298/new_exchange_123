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

import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
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

export default function AgentsScreen({ navigation }) {
  const [agents, setAgents] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [currentAgent, setCurrentAgent] = useState({
    id: '',
    name: '',
    contact: '',
    balance: '0',
  });

  const sortAgents = useCallback((list) => {
    const arr = [...(list || [])];
    arr.sort((a, b) => {
      const dateA = a.updatedAt ? new Date(a.updatedAt) : new Date(a.createdAt || 0);
      const dateB = b.updatedAt ? new Date(b.updatedAt) : new Date(b.createdAt || 0);
      return dateB - dateA;
    });
    return arr;
  }, []);

  const loadAgentsFromStorage = useCallback(async () => {
    try {
      const storedAgents = await AsyncStorage.getItem('agents');
      if (storedAgents) {
        const list = sortAgents(JSON.parse(storedAgents));
        setAgents(list);
      }
    } catch (error) {
      console.error('Error loading agents from storage:', error);
    }
  }, [sortAgents]);

  // ✅ Manual fetch (used for pull-to-refresh)
  const fetchAgentsOnce = useCallback(async () => {
    const snap = await getDocs(collection(db, 'agents'));
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const sorted = sortAgents(list);
    setAgents(sorted);
    await AsyncStorage.setItem('agents', JSON.stringify(sorted));
  }, [sortAgents]);

  // ✅ Realtime snapshot (kept)
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'agents'),
      async (snapshot) => {
        const list = [];
        snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
        const sorted = sortAgents(list);
        setAgents(sorted);
        AsyncStorage.setItem('agents', JSON.stringify(sorted));
      },
      async (error) => {
        console.error('Firestore error:', error);
        await loadAgentsFromStorage();
      }
    );

    return () => unsubscribe();
  }, [loadAgentsFromStorage, sortAgents]);

  // ✅ Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchAgentsOnce();
    } catch (e) {
      console.error('Agent refresh failed:', e);
      await loadAgentsFromStorage();
      Alert.alert('Offline', 'Loaded agents from device storage.');
    } finally {
      setRefreshing(false);
    }
  }, [fetchAgentsOnce, loadAgentsFromStorage]);

  // ✅ Filtered list (derived)
  const filteredAgents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return agents;

    return agents.filter((agent) => {
      const nameMatch = (agent.name || '').toLowerCase().includes(q);
      const contactMatch = (agent.contact || '').includes(searchQuery.trim());
      return nameMatch || contactMatch;
    });
  }, [agents, searchQuery]);

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

      if (!currentAgent.id) {
        agentData.createdAt = getTodayDate();
      }

      // ✅ Update UI immediately
      let updatedAgents;
      if (currentAgent.id) {
        updatedAgents = agents.map((a) =>
          a.id === currentAgent.id ? { ...a, ...agentData, id: currentAgent.id } : a
        );
      } else {
        const tempId = `temp_${Date.now()}`;
        updatedAgents = [{ ...agentData, id: tempId }, ...agents];
      }

      updatedAgents = sortAgents(updatedAgents);
      setAgents(updatedAgents);
      await AsyncStorage.setItem('agents', JSON.stringify(updatedAgents));

      // ✅ Save to Firestore
      if (currentAgent.id) {
        const updateData = { ...agentData };
        delete updateData.createdAt;
        await updateDoc(doc(db, 'agents', currentAgent.id), updateData);
        Alert.alert('Success', 'Agent updated!');
      } else {
        const docRef = await addDoc(collection(db, 'agents'), agentData);
        const realAgent = { id: docRef.id, ...agentData };

        const finalList = updatedAgents.map((a) =>
          typeof a.id === 'string' && a.id.startsWith('temp_') ? realAgent : a
        );

        const sortedFinal = sortAgents(finalList);
        setAgents(sortedFinal);
        await AsyncStorage.setItem('agents', JSON.stringify(sortedFinal));

        Alert.alert('Success', 'Agent added!');
      }

      setModalVisible(false);
      setCurrentAgent({ id: '', name: '', contact: '', balance: '0' });
    } catch (error) {
      console.error('Error saving agent:', error);
      Alert.alert('Saved locally', 'Could not sync to cloud. Saved to device storage.');
      setModalVisible(false);
      setCurrentAgent({ id: '', name: '', contact: '', balance: '0' });
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
              await deleteDoc(doc(db, 'agents', agentId));

              const updated = agents.filter((a) => a.id !== agentId);
              setAgents(updated);
              await AsyncStorage.setItem('agents', JSON.stringify(updated));
              await AsyncStorage.removeItem(`agent_transactions_${agentId}`);

              Alert.alert('Success', 'Agent deleted!');
            } catch (error) {
              console.error('Error deleting agent:', error);

              // fallback local delete
              const updated = agents.filter((a) => a.id !== agentId);
              setAgents(updated);
              await AsyncStorage.setItem('agents', JSON.stringify(updated));
              await AsyncStorage.removeItem(`agent_transactions_${agentId}`);

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
        <Text style={styles.screenTitle}>Agent Management</Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>


          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              setCurrentAgent({ id: '', name: '', contact: '', balance: '0' });
              setModalVisible(true);
            }}
          >
            <Icon name="plus" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Icon name="magnify" size={20} color="#666" style={styles.searchIcon} />
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

      {/* Count */}
      <View style={styles.customerCountContainer}>
        <Text style={styles.customerCountText}>
          {filteredAgents.length} agent{filteredAgents.length !== 1 ? 's' : ''}
          {searchQuery ? ` found for "${searchQuery}"` : ''}
        </Text>
        <Text style={styles.sortText}>Sorted by: Last Updated</Text>
      </View>

      {/* ✅ Pull-to-refresh added here */}
      <FlatList
        data={filteredAgents}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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
                    setCurrentAgent({
                      id: item.id,
                      name: item.name || '',
                      contact: item.contact || '',
                      balance: String(item.balance ?? '0'),
                    });
                    setModalVisible(true);
                  }}
                >
                  <Icon name="pencil" size={18} color="#007AFF" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => deleteAgent(item.id)}
                >
                  <Icon name="trash-can-outline" size={18} color="#FF3B30" />
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
                  {item.balance > 0 ? 'You owe agent' : item.balance < 0 ? 'Agent owes you' : 'Settled'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="account-tie" size={64} color="#ccc" />
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
        transparent
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
              onChangeText={(text) => setCurrentAgent({ ...currentAgent, name: text })}
            />

            <TextInput
              style={styles.input}
              placeholder="Contact (Optional)"
              value={currentAgent.contact}
              onChangeText={(text) => setCurrentAgent({ ...currentAgent, contact: text })}
            />

            <TextInput
              style={styles.input}
              placeholder="Balance (BDT)"
              value={currentAgent.balance}
              onChangeText={(text) => setCurrentAgent({ ...currentAgent, balance: text })}
              keyboardType="numeric"
            />

            {currentAgent.balance ? (
              <View style={styles.balancePreview}>
                <Text style={styles.balancePreviewText}>
                  Balance: {formatCurrency(parseFloat(currentAgent.balance) || 0)}
                </Text>
                <Text
                  style={[
                    styles.balancePreviewStatus,
                    parseFloat(currentAgent.balance) > 0
                      ? styles.positiveBalance
                      : parseFloat(currentAgent.balance) < 0
                      ? styles.negativeBalance
                      : styles.neutralBalance,
                  ]}
                >
                  {parseFloat(currentAgent.balance) > 0
                    ? 'You will owe agent'
                    : parseFloat(currentAgent.balance) < 0
                    ? 'Agent will owe you'
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
}
