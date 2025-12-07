import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState, useRef } from "react";
import {
  Animated,
  Dimensions,
  Linking,
  Modal,
  PanResponder,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getSupabaseClient, isSupabaseConfigured } from "../../lib/supabase";
import { Calendar } from "react-native-calendars";
import { sendWhatsAppMessage } from "../../lib/whatsapp";

const FILTER_STORAGE_KEY = "@airtel_customer_town_filter";
const VISIT_DATE_FILTER_KEY = "@airtel_customer_visit_date_filter";
const ITEM_HEIGHT = 50;

interface Customer {
  id: string;
  customer_name: string;
  installation_town: string;
  airtel_number?: string;
  alternate_number?: string;
  email?: string;
  preferred_package?: string;
  delivery_landmark?: string;
  visit_date?: string;
  visit_time?: string;
  created_at?: string;
  agent_name?: string;
  agent_mobile?: string;
  lead_type?: string;
  connection_type?: string;
}

export default function CustomersScreen() {
  const [premiumCount, setPremiumCount] = useState<number | null>(null);
  const [standardCount, setStandardCount] = useState<number | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTown, setSelectedTown] = useState<string | null>(null);
  const [availableTowns, setAvailableTowns] = useState<string[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  const [selectedVisitDate, setSelectedVisitDate] = useState<string | null>(null);
  const [availableVisitDates, setAvailableVisitDates] = useState<string[]>([]);
  const [showVisitDateModal, setShowVisitDateModal] = useState(false);
  const [markedDates, setMarkedDates] = useState<{ [key: string]: any }>({});
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [whatsAppMessage, setWhatsAppMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isSupabaseConfigured) {
      loadSavedFilter();
      loadSavedVisitDateFilter();
      fetchTowns();
      fetchVisitDates();
      fetchCounts(true); // Show loading on initial fetch
      fetchCustomers(true); // Show loading on initial fetch

      // Set up Realtime subscription
      const supabase = getSupabaseClient();
      const channel = supabase
        .channel("customers-changes")
        .on(
          "postgres_changes",
          {
            event: "*", // Listen to all events (INSERT, UPDATE, DELETE)
            schema: "public",
            table: "leads",
          },
          (payload) => {
            // Refetch data when any change occurs
            fetchTowns();
            fetchVisitDates();
            fetchCounts();
            fetchCustomers();
          }
        )
        .subscribe();

      // Cleanup subscription on unmount
      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSupabaseConfigured) {
      fetchCustomers();
    }
  }, [searchQuery, selectedTown, selectedVisitDate]);

  // Update marked dates when dates or selection changes
  useEffect(() => {
    const marked: { [key: string]: any } = {};
    availableVisitDates.forEach((date) => {
      marked[date] = {
        marked: true,
        dotColor: "#FFD700",
      };
    });
    
    if (selectedVisitDate && marked[selectedVisitDate]) {
      marked[selectedVisitDate] = {
        ...marked[selectedVisitDate],
        selected: true,
        selectedColor: "#FFD700",
        selectedTextColor: "#000000",
      };
    }
    
    setMarkedDates(marked);
  }, [availableVisitDates, selectedVisitDate]);

  const loadSavedFilter = async () => {
    try {
      const savedFilter = await AsyncStorage.getItem(FILTER_STORAGE_KEY);
      if (savedFilter) {
        setSelectedTown(savedFilter);
      }
    } catch (error) {
      console.error("Error loading saved filter:", error);
    }
  };

  const loadSavedVisitDateFilter = async () => {
    try {
      const savedFilter = await AsyncStorage.getItem(VISIT_DATE_FILTER_KEY);
      if (savedFilter) {
        setSelectedVisitDate(savedFilter);
      }
    } catch (error) {
      console.error("Error loading saved visit date filter:", error);
    }
  };

  const saveFilter = async (town: string | null) => {
    try {
      if (town) {
        await AsyncStorage.setItem(FILTER_STORAGE_KEY, town);
      } else {
        await AsyncStorage.removeItem(FILTER_STORAGE_KEY);
      }
      setSelectedTown(town);
    } catch (error) {
      console.error("Error saving filter:", error);
    }
  };

  const saveVisitDateFilter = async (date: string | null) => {
    try {
      if (date) {
        await AsyncStorage.setItem(VISIT_DATE_FILTER_KEY, date);
      } else {
        await AsyncStorage.removeItem(VISIT_DATE_FILTER_KEY);
      }
      setSelectedVisitDate(date);
    } catch (error) {
      console.error("Error saving visit date filter:", error);
    }
  };

  const fetchTowns = async () => {
    if (!isSupabaseConfigured) {
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("leads")
        .select("installation_town")
        .order("installation_town", { ascending: true });

      if (error) {
        console.error("Error fetching towns:", error);
        setAvailableTowns([]);
      } else {
        // Get unique towns
        const uniqueTowns = Array.from(
          new Set(data?.map((item) => item.installation_town) || [])
        ).filter((town) => town && town.trim() !== "");
        setAvailableTowns(uniqueTowns);
      }
    } catch (error) {
      console.error("Error:", error);
      setAvailableTowns([]);
    }
  };

  const fetchVisitDates = async () => {
    if (!isSupabaseConfigured) {
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("leads")
        .select("visit_date")
        .not("visit_date", "is", null)
        .order("visit_date", { ascending: true });

      if (error) {
        console.error("Error fetching visit dates:", error);
        setAvailableVisitDates([]);
      } else {
        // Get unique visit dates
        const uniqueDates = Array.from(
          new Set(data?.map((item) => item.visit_date) || [])
        ).filter((date) => date && date.trim() !== "");
        setAvailableVisitDates(uniqueDates);
      }
    } catch (error) {
      console.error("Error:", error);
      setAvailableVisitDates([]);
    }
  };

  const fetchCounts = async (showLoadingState = false) => {
    if (!isSupabaseConfigured) {
      if (showLoadingState) setLoading(false);
      return;
    }

    try {
      if (showLoadingState) setLoading(true);
      const supabase = getSupabaseClient();

      // Fetch premium customers count (assuming "premium" is in preferred_package)
      const { count: premium, error: premiumError } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .ilike("preferred_package", "%premium%");

      if (premiumError) {
        console.error("Error fetching premium count:", premiumError);
        setPremiumCount(0);
      } else {
        setPremiumCount(premium || 0);
      }

      // Fetch standard customers count (assuming "standard" is in preferred_package)
      const { count: standard, error: standardError } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .ilike("preferred_package", "%standard%");

      if (standardError) {
        console.error("Error fetching standard count:", standardError);
        setStandardCount(0);
      } else {
        setStandardCount(standard || 0);
      }
    } catch (error) {
      console.error("Error:", error);
      setPremiumCount(0);
      setStandardCount(0);
    } finally {
      if (showLoadingState) {
        setLoading(false);
      }
    }
  };

  const fetchCustomers = async (showLoadingState = false) => {
    if (!isSupabaseConfigured) {
      return;
    }

    try {
      if (showLoadingState) setLoading(true);
      const supabase = getSupabaseClient();
      let query = supabase
        .from("leads")
        .select(
          "id, customer_name, installation_town, airtel_number, alternate_number, email, preferred_package, delivery_landmark, visit_date, visit_time, created_at, agent_name, agent_mobile, lead_type, connection_type"
        )
        .order("installation_town", { ascending: true })
        .order("customer_name", { ascending: true });

      // Apply town filter
      if (selectedTown) {
        query = query.eq("installation_town", selectedTown);
      }

      // Apply visit date filter
      if (selectedVisitDate) {
        query = query.eq("visit_date", selectedVisitDate);
      }

      // Apply search filter if there's a query
      if (searchQuery.trim()) {
        query = query.or(
          `customer_name.ilike.%${searchQuery}%,installation_town.ilike.%${searchQuery}%`
        );
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching customers:", error);
        setCustomers([]);
      } else {
        setCustomers(data || []);
      }
    } catch (error) {
      console.error("Error:", error);
      setCustomers([]);
    } finally {
      if (showLoadingState) {
        setLoading(false);
      }
    }
  };

  // Format date as "4 thurs 2025"
  const formatDate = () => {
    const today = new Date();
    const day = today.getDate();
    const dayNames = ["sun", "mon", "tues", "wed", "thurs", "fri", "sat"];
    const dayName = dayNames[today.getDay()];
    const year = today.getFullYear();
    return `${day} ${dayName} ${year}`;
  };

  // Format visit date as "sun Dec 2025"
  const formatVisitDate = (dateString: string) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      const dayNames = ["sun", "mon", "tues", "wed", "thurs", "fri", "sat"];
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const dayName = dayNames[date.getDay()];
      const monthName = monthNames[date.getMonth()];
      const year = date.getFullYear();
      return `${dayName} ${monthName} ${year}`;
    } catch (error) {
      return dateString;
    }
  };

  // Format registration date as "sun Dec 2025"
  const formatRegistrationDate = (dateString: string) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      const dayNames = ["sun", "mon", "tues", "wed", "thurs", "fri", "sat"];
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const dayName = dayNames[date.getDay()];
      const monthName = monthNames[date.getMonth()];
      const year = date.getFullYear();
      return `${dayName} ${monthName} ${year}`;
    } catch (error) {
      return dateString;
    }
  };

  // Format date for picker as "04 Dec 2024"
  const formatDateForPicker = (dateString: string) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      const day = date.getDate().toString().padStart(2, "0");
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const monthName = monthNames[date.getMonth()];
      const year = date.getFullYear();
      return `${day} ${monthName} ${year}`;
    } catch (error) {
      return dateString;
    }
  };

  // Organize dates: past below, future above, current in center
  // This uses a consistent chronological ordering to prevent date switching
  const organizeDatesForPicker = (dates: string[], selectedDate: string | null) => {
    if (dates.length === 0) return [];
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Sort all dates chronologically
    const sortedDates = [...dates].sort((a, b) => {
      return new Date(a).getTime() - new Date(b).getTime();
    });
    
    // Find today's index in the sorted array
    const todayIndex = sortedDates.findIndex((date) => {
      const dateObj = new Date(date);
      dateObj.setHours(0, 0, 0, 0);
      return dateObj.getTime() === today.getTime();
    });
    
    // If we have a selected date, find its index
    let selectedIndex = -1;
    if (selectedDate) {
      selectedIndex = sortedDates.indexOf(selectedDate);
    }
    
    // Use selected date as center if available, otherwise use today
    const centerIndex = selectedIndex >= 0 ? selectedIndex : (todayIndex >= 0 ? todayIndex : Math.floor(sortedDates.length / 2));
    
    // Split into past and future relative to center
    const centerDate = sortedDates[centerIndex];
    const pastDates: string[] = [];
    const futureDates: string[] = [];
    const centerDates: string[] = [];
    
    sortedDates.forEach((date) => {
      const dateObj = new Date(date);
      dateObj.setHours(0, 0, 0, 0);
      const centerDateObj = new Date(centerDate);
      centerDateObj.setHours(0, 0, 0, 0);
      
      if (dateObj.getTime() < centerDateObj.getTime()) {
        pastDates.push(date);
      } else if (dateObj.getTime() > centerDateObj.getTime()) {
        futureDates.push(date);
      } else {
        centerDates.push(date);
      }
    });
    
    // Return: past (descending) -> center -> future (ascending)
    return [...pastDates.reverse(), ...centerDates, ...futureDates];
  };

  // Format name: capitalize first letter of each word
  const formatName = (name: string) => {
    if (!name) return name;
    return name
      .split(" ")
      .map((word) => {
        if (!word) return word;
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(" ");
  };

  // Format phone number: remove 254 prefix and show as 07 or 01
  const formatPhoneNumber = (phone: string) => {
    if (!phone) return phone;
    // Remove any spaces or dashes
    let cleaned = phone.replace(/\s|-/g, "");
    // Remove 254 prefix if present
    if (cleaned.startsWith("254")) {
      cleaned = cleaned.substring(3);
    }
    // Ensure it starts with 0
    if (!cleaned.startsWith("0")) {
      cleaned = "0" + cleaned;
    }
    return cleaned;
  };

  // Get full phone number with +254 prefix for calling
  const getFullPhoneNumber = (phone: string) => {
    if (!phone) return phone;
    let cleaned = phone.replace(/\s|-/g, "");
    // Remove + if present
    if (cleaned.startsWith("+")) {
      cleaned = cleaned.substring(1);
    }
    if (cleaned.startsWith("0")) {
      cleaned = cleaned.substring(1);
    }
    if (!cleaned.startsWith("254")) {
      cleaned = "254" + cleaned;
    }
    return "+" + cleaned;
  };

  // Call phone number
  const handleCallNumber = (phone: string) => {
    const fullNumber = getFullPhoneNumber(phone);
    const phoneUrl = `tel:${fullNumber}`;
    Linking.openURL(phoneUrl).catch((err) => {
      console.error("Error calling:", err);
    });
  };

  // Test WhatsApp message
  const handleTestWhatsApp = async () => {
    setSendingWhatsApp(true);
    setWhatsAppMessage(null);

    try {
      const result = await sendWhatsAppMessage({
        to: "+254724832555",
        contentSid: "HXb5b62575e6e4ff6129ad7c8efe1f983e",
        contentVariables: {
          "1": "12/1",
          "2": "3pm"
        }
      });

      if (result.success) {
        setWhatsAppMessage("✅ WhatsApp sent successfully!");
        // Clear message after 3 seconds
        setTimeout(() => setWhatsAppMessage(null), 3000);
      } else {
        setWhatsAppMessage(`❌ Error: ${result.error || "Failed to send"}`);
        // Clear message after 5 seconds
        setTimeout(() => setWhatsAppMessage(null), 5000);
      }
    } catch (error) {
      setWhatsAppMessage(`❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`);
      setTimeout(() => setWhatsAppMessage(null), 5000);
    } finally {
      setSendingWhatsApp(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Section */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Airtel Dashboard</Text>
        <Text style={styles.headerDate}>{formatDate()}</Text>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        {/* Premium */}
        <View style={styles.statItem}>
          {loading ? (
            <Text style={styles.countText}>-</Text>
          ) : (
            <Text style={styles.countText}>
              {premiumCount !== null ? premiumCount : 0}
            </Text>
          )}
          <Text style={styles.labelText}>premium customers</Text>
        </View>

        {/* Separator */}
        <View style={styles.separator} />

        {/* Standard */}
        <View style={styles.statItem}>
          {loading ? (
            <Text style={styles.countText}>-</Text>
          ) : (
            <Text style={styles.countText}>
              {standardCount !== null ? standardCount : 0}
            </Text>
          )}
          <Text style={styles.labelText}>standard customers</Text>
        </View>
      </View>

      {/* Test WhatsApp Button */}
      <View style={styles.testWhatsAppContainer}>
        <TouchableOpacity
          style={[styles.testWhatsAppButton, sendingWhatsApp && styles.testWhatsAppButtonDisabled]}
          onPress={handleTestWhatsApp}
          disabled={sendingWhatsApp}
        >
          <Ionicons
            name="logo-whatsapp"
            size={20}
            color="#FFFFFF"
            style={styles.testWhatsAppIcon}
          />
          <Text style={styles.testWhatsAppText}>
            {sendingWhatsApp ? "Sending..." : "Test WhatsApp Message"}
          </Text>
        </TouchableOpacity>
        {whatsAppMessage && (
          <Text style={styles.whatsAppMessageText}>{whatsAppMessage}</Text>
        )}
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons
            name="search"
            size={20}
            color="#9CA3AF"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search customers..."
            placeholderTextColor="#6B7280"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.searchSeparator} />
      </View>

      {/* Filters */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilterModal(true)}
        >
          <Ionicons
            name="filter"
            size={18}
            color={selectedTown ? "#FFD700" : "#9CA3AF"}
          />
          <Text
            style={[
              styles.filterText,
              selectedTown && styles.filterTextActive,
            ]}
          >
            {selectedTown || "All Towns"}
          </Text>
          <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
        </TouchableOpacity>
        {selectedTown && (
          <TouchableOpacity
            style={styles.clearFilterButton}
            onPress={() => saveFilter(null)}
          >
            <Ionicons name="close-circle" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        )}
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setShowVisitDateModal(true)}
            >
              <Ionicons
                name="calendar"
                size={18}
                color={selectedVisitDate ? "#FFD700" : "#9CA3AF"}
              />
              <Text
                style={[
                  styles.filterText,
                  selectedVisitDate && styles.filterTextActive,
                ]}
              >
                {selectedVisitDate
                  ? formatDateForPicker(selectedVisitDate)
                  : "All Visit Dates"}
              </Text>
              <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
            </TouchableOpacity>
        {selectedVisitDate && (
          <TouchableOpacity
            style={styles.clearFilterButton}
            onPress={() => saveVisitDateFilter(null)}
          >
            <Ionicons name="close-circle" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Customers List */}
      <View style={styles.customersSection}>
        <ScrollView
          style={styles.customersList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await fetchCounts();
                await fetchCustomers();
                setRefreshing(false);
              }}
              tintColor="#FFD700"
              colors={["#FFD700"]}
            />
          }
        >
        {loading && customers.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Loading...</Text>
          </View>
        ) : customers.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No customers found</Text>
          </View>
        ) : (
          customers.map((customer) => {
            const isExpanded = expandedCustomerId === customer.id;
            return (
              <View key={customer.id}>
                <TouchableOpacity
                  style={styles.customerRow}
                  onPress={() =>
                    setExpandedCustomerId(isExpanded ? null : customer.id)
                  }
                  activeOpacity={0.7}
                >
                  <Text style={styles.customerName} numberOfLines={1}>
                    {formatName(customer.customer_name)}
                  </Text>
                  <View style={styles.customerRowRight}>
                    <Text style={styles.customerTown} numberOfLines={1}>
                      {customer.installation_town}
                    </Text>
                    <Ionicons
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={20}
                      color="#9CA3AF"
                      style={styles.expandIcon}
                    />
                  </View>
                </TouchableOpacity>
                {isExpanded && (
                  <View style={styles.customerDetails}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Email</Text>
                      <Text style={styles.detailValue}>
                        {customer.email || "N/A"}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Package</Text>
                      <Text style={styles.detailValue}>
                        {customer.preferred_package || "N/A"}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.detailRow}
                      onPress={() =>
                        customer.airtel_number &&
                        handleCallNumber(customer.airtel_number)
                      }
                      disabled={!customer.airtel_number}
                      activeOpacity={customer.airtel_number ? 0.7 : 1}
                    >
                      <Text style={styles.detailLabel}>Airtel</Text>
                      <Text
                        style={[
                          styles.detailValue,
                          customer.airtel_number && styles.detailValueClickable,
                        ]}
                      >
                        {customer.airtel_number
                          ? formatPhoneNumber(customer.airtel_number)
                          : "N/A"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.detailRow}
                      onPress={() =>
                        customer.alternate_number &&
                        handleCallNumber(customer.alternate_number)
                      }
                      disabled={!customer.alternate_number}
                      activeOpacity={customer.alternate_number ? 0.7 : 1}
                    >
                      <Text style={styles.detailLabel}>Alternate</Text>
                      <Text
                        style={[
                          styles.detailValue,
                          customer.alternate_number && styles.detailValueClickable,
                        ]}
                      >
                        {customer.alternate_number
                          ? formatPhoneNumber(customer.alternate_number)
                          : "N/A"}
                      </Text>
                    </TouchableOpacity>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Landmark</Text>
                      <Text style={styles.detailValue}>
                        {customer.delivery_landmark || "N/A"}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Visit Date</Text>
                      <Text style={styles.detailValue}>
                        {customer.visit_date
                          ? formatVisitDate(customer.visit_date)
                          : "N/A"}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Visit Time</Text>
                      <Text style={styles.detailValue}>
                        {customer.visit_time || "N/A"}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Registration Date</Text>
                      <Text style={styles.detailValue}>
                        {customer.created_at
                          ? formatRegistrationDate(customer.created_at)
                          : "N/A"}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}
        </ScrollView>
      </View>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowFilterModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by Town</Text>
              <TouchableOpacity
                onPress={() => setShowFilterModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              <TouchableOpacity
                style={[
                  styles.modalItem,
                  !selectedTown && styles.modalItemActive,
                ]}
                onPress={() => {
                  saveFilter(null);
                  setShowFilterModal(false);
                }}
              >
                <Text
                  style={[
                    styles.modalItemText,
                    !selectedTown && styles.modalItemTextActive,
                  ]}
                >
                  All Towns
                </Text>
                {!selectedTown && (
                  <Ionicons name="checkmark" size={20} color="#FFD700" />
                )}
              </TouchableOpacity>
              {availableTowns.map((town) => (
                <TouchableOpacity
                  key={town}
                  style={[
                    styles.modalItem,
                    selectedTown === town && styles.modalItemActive,
                  ]}
                  onPress={() => {
                    saveFilter(town);
                    setShowFilterModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      selectedTown === town && styles.modalItemTextActive,
                    ]}
                  >
                    {town}
                  </Text>
                  {selectedTown === town && (
                    <Ionicons name="checkmark" size={20} color="#FFD700" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Visit Date Filter Modal */}
      <Modal
        visible={showVisitDateModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowVisitDateModal(false)}
      >
        <TouchableOpacity
          style={styles.visitDateModalOverlay}
          activeOpacity={1}
          onPress={() => setShowVisitDateModal(false)}
        >
          <View style={styles.visitDateModalContent}>
            {/* Swipe handle indicator */}
            <View style={styles.modalSwipeHandle} />
            <View style={styles.visitDateModalHeader}>
              <TouchableOpacity
                onPress={() => setShowVisitDateModal(false)}
                style={styles.visitDateModalCancel}
              >
                <Text style={styles.visitDateModalCancelText}>Cancel</Text>
              </TouchableOpacity>
                  <Text style={styles.visitDateModalTitle}>Select Visit Date</Text>
              <TouchableOpacity
                onPress={() => {
                  if (selectedVisitDate) {
                    saveVisitDateFilter(selectedVisitDate);
                  }
                  setShowVisitDateModal(false);
                }}
                style={styles.visitDateModalDone}
              >
                <Text style={styles.visitDateModalDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.calendarContainer}>
              <Calendar
                markedDates={markedDates}
                onDayPress={(day) => {
                  const dateString = day.dateString;
                  if (availableVisitDates.includes(dateString)) {
                    setSelectedVisitDate(dateString);
                  }
                }}
                minDate={availableVisitDates.length > 0 ? availableVisitDates[0] : undefined}
                maxDate={availableVisitDates.length > 0 ? availableVisitDates[availableVisitDates.length - 1] : undefined}
                enableSwipeMonths={true}
                theme={{
                  backgroundColor: "#1A1A1A",
                  calendarBackground: "#1A1A1A",
                  textSectionTitleColor: "#9CA3AF",
                  selectedDayBackgroundColor: "#FFD700",
                  selectedDayTextColor: "#000000",
                  todayTextColor: "#10B981",
                  dayTextColor: "#FFFFFF",
                  textDisabledColor: "#4B5563",
                  dotColor: "#FFD700",
                  selectedDotColor: "#000000",
                  arrowColor: "#FFD700",
                  monthTextColor: "#FFFFFF",
                  indicatorColor: "#FFD700",
                  textDayFontFamily: "Inter_400Regular",
                  textMonthFontFamily: "Montserrat_600SemiBold",
                  textDayHeaderFontFamily: "Inter_500Medium",
                  textDayFontSize: 16,
                  textMonthFontSize: 18,
                  textDayHeaderFontSize: 14,
                }}
                markingType="multi-dot"
                disableAllTouchEventsForDisabledDays={true}
                hideExtraDays={true}
              />
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0A", // Dark background
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
    width: "100%",
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: "Montserrat_600SemiBold",
    color: "#FFD700", // Golden/yellow color
  },
  headerDate: {
    fontSize: 14,
    fontFamily: "Montserrat_400Regular",
    color: "#9CA3AF",
    textTransform: "lowercase",
    flexShrink: 0,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 40,
    width: "100%",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  separator: {
    width: 1,
    height: 60,
    backgroundColor: "#2A2A2A",
    marginHorizontal: 8,
  },
  countText: {
    fontSize: 48,
    fontFamily: "Inter_700Bold",
    color: "#FFD700", // Yellow/gold accent (Airtel brand color)
    letterSpacing: -0.5,
  },
  labelText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#FFFFFF", // White text for dark background
    marginTop: 8,
    letterSpacing: 0.2,
    textAlign: "center",
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#FFFFFF",
    padding: 0,
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  searchSeparator: {
    height: 1,
    backgroundColor: "#2A2A2A",
    marginTop: 16,
  },
  filterContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 12,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  filterText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#9CA3AF",
  },
  filterTextActive: {
    color: "#FFD700",
    fontFamily: "Inter_600SemiBold",
  },
  clearFilterButton: {
    padding: 4,
  },
  customersSection: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 62, // Add bottom padding to avoid tab bar
  },
  customersList: {
    flex: 1,
  },
  customerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
  },
  customerName: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#FFD700", // Golden color for name
    marginRight: 16,
  },
  customerRowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  customerTown: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#FFFFFF", // White color for town
    textAlign: "right",
  },
  expandIcon: {
    marginLeft: 4,
  },
  customerDetails: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#0A0A0A",
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2A",
    marginHorizontal: -20,
    borderLeftWidth: 3,
    borderLeftColor: "#FFD700",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2A",
  },
  detailLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    width: 100,
    flexShrink: 0,
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#FFFFFF",
    textAlign: "right",
    paddingLeft: 16,
  },
  detailValueClickable: {
    color: "#FFD700",
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    width: "85%",
    maxHeight: "70%",
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2A",
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Montserrat_600SemiBold",
    color: "#FFFFFF",
  },
  modalCloseButton: {
    padding: 4,
  },
  modalList: {
    maxHeight: 400,
  },
  modalItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
  },
  modalItemActive: {
    backgroundColor: "#2A2A2A",
  },
  modalItemText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#FFFFFF",
  },
  modalItemTextActive: {
    color: "#FFD700",
    fontFamily: "Inter_600SemiBold",
  },
  visitDateModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  visitDateModalContent: {
    backgroundColor: "#1A1A1A",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: "80%",
  },
  modalSwipeHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#6B7280",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  visitDateModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2A",
  },
  visitDateModalCancel: {
    padding: 4,
  },
  visitDateModalCancelText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#9CA3AF",
  },
  visitDateModalTitle: {
    fontSize: 18,
    fontFamily: "Montserrat_600SemiBold",
    color: "#FFFFFF",
  },
  visitDateModalDone: {
    padding: 4,
  },
  visitDateModalDoneText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFD700",
  },
  calendarContainer: {
    padding: 20,
    paddingTop: 0,
  },
  testWhatsAppContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  testWhatsAppButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#25D366",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    minWidth: 200,
    justifyContent: "center",
  },
  testWhatsAppButtonDisabled: {
    opacity: 0.6,
  },
  testWhatsAppIcon: {
    marginRight: 8,
  },
  testWhatsAppText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  whatsAppMessageText: {
    marginTop: 8,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#9CA3AF",
    textAlign: "center",
  },
});
