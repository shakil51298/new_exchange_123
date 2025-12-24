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

import Icon from 'react-native-vector-icons/MaterialIcons';

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

export default function AgentsScreen({ navigation }) {
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
}
