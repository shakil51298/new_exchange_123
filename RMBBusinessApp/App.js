// App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';


import DashboardScreen from './src/screens/DashboardScreen';
import CustomersScreen from './src/screens/CustomersScreen';
import CustomerDetailsScreen from './src/screens/CustomerDetailsScreen';
import SuppliersScreen from './src/screens/SuppliersScreen';
import SupplierDetailsScreen from './src/screens/SupplierDetailsScreen';
import AgentsScreen from './src/screens/AgentsScreen';
import AgentDetailsScreen from './src/screens/AgentDetailsScreen';
import BanksScreen from './src/screens/BanksScreen';
import BankWalletDetailsScreen from './src/screens/BankWalletDetailsScreen';

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
        <Stack.Screen name="AgentDetails" component={AgentDetailsScreen} options={{ title: 'Agent Details' }} />
        <Stack.Screen name="Banks" component={BanksScreen} />
        <Stack.Screen
          name="BankWalletDetails"
          component={BankWalletDetailsScreen}
          options={({ route }) => ({
            title: route.params.type === 'bank' ? 'Bank Details' : 'Wallet Details',
          })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
