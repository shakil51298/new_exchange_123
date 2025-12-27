// src/styles/styles.js
import { StyleSheet } from 'react-native';

// ✅ Paste your ENTIRE StyleSheet.create({ ... }) here from App.js
const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#f5f5f9',
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      textAlign: 'center',
      marginTop: 10,
      marginBottom: 10,
      color: '#f5f',
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



export default styles;