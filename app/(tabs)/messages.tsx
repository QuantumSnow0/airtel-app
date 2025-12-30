import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useNavigation } from "expo-router";
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { getSupabaseClient, isSupabaseConfigured } from "../../lib/supabase";
import {
  formatWhatsAppNumber,
  sendWhatsAppMessage,
  sendWhatsAppTextMessage,
} from "../../lib/whatsapp";

interface Customer {
  id: string;
  customer_name: string;
  installation_town?: string;
  airtel_number?: string;
  alternate_number?: string;
  preferred_package?: string;
  whatsapp_response?: string | null;
  whatsapp_response_date?: string | null;
  whatsapp_message_sent_date?: string | null;
  created_at?: string;
  status?: string; // 'new' for unrecognized customers
  source?: string; // 'whatsapp_inbound' for auto-created leads
  needs_agent_review?: boolean; // Flagged for agent review
  is_pinned?: boolean; // Pinned conversation
}

interface Conversation {
  customer: Customer;
  lastMessage?: {
    body: string;
    timestamp: string;
    direction: "inbound" | "outbound";
    type: "text" | "template" | "button_click" | "media";
  };
  unreadCount: number;
}

interface WhatsAppMessage {
  id: string;
  created_at: string;
  lead_id: string | null;
  customer_phone: string;
  customer_name: string | null;
  message_body: string;
  message_sid: string | null;
  message_type: "text" | "template" | "button_click" | "media";
  direction: "inbound" | "outbound";
  button_payload: string | null;
  button_text: string | null;
  template_sid: string | null;
  template_variables: any;
  status: string | null;
  is_ai_response?: boolean;
  needs_agent_review?: boolean;
  auto_reply_status?: string | null;
}

// WhatsApp Template SID
const WHATSAPP_TEMPLATE_SID = "HX789c39c28be5d338da1fa36ad9b47352";

type FilterType =
  | "all"
  | "yes"
  | "no"
  | "no_response"
  | "registered_today"
  | "registered_this_week"
  | "registered_old"
  | "new"
  | "needs_review";

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [allConversations, setAllConversations] = useState<Conversation[]>([]); // Store all loaded conversations
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sendingBatch, setSendingBatch] = useState(false);

  // Chat view state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [chatMessages, setChatMessages] = useState<WhatsAppMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [sendingText, setSendingText] = useState(false);
  const [showCustomerInfo, setShowCustomerInfo] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const chatScrollViewRef = useRef<ScrollView>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [selectedMessageForAction, setSelectedMessageForAction] = useState<WhatsAppMessage | null>(null);
  const [showMessageActionMenu, setShowMessageActionMenu] = useState(false);
  const [longPressedConversation, setLongPressedConversation] = useState<string | null>(null);

  // Hide/show tab bar when chat is open/closed
  useLayoutEffect(() => {
    const bottomInset = insets.bottom > 0 ? insets.bottom : 0;

    if (selectedCustomer) {
      // Hide tab bar when in chat view
      navigation.setOptions({
        tabBarStyle: { display: "none" },
      });
    } else {
      // Restore tab bar style to match tab layout (with proper background)
      navigation.setOptions({
        tabBarStyle: {
          backgroundColor: "rgba(10, 10, 10, 0.95)", // Dark background with slight transparency
          borderTopWidth: 0,
          height: 64,
          position: "absolute",
          left: 16,
          right: 16,
          bottom: bottomInset,
          borderRadius: 20,
          paddingTop: 8,
          paddingBottom: 8,
          elevation: 0,
          shadowColor: "transparent",
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0,
          shadowRadius: 0,
        },
      });
    }
  }, [selectedCustomer, navigation, insets.bottom]);

  // Animate customer info panel
  useEffect(() => {
    if (showCustomerInfo) {
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    }
  }, [showCustomerInfo]);

  const messageInputBottomPadding = Math.max(insets.bottom, 4);

  // Format date as "4 thurs 2025"
  const formatDate = () => {
    const today = new Date();
    const day = today.getDate();
    const dayNames = ["sun", "mon", "tues", "wed", "thurs", "fri", "sat"];
    const dayName = dayNames[today.getDay()];
    const year = today.getFullYear();
    return `${day} ${dayName} ${year}`;
  };

  // Format customer name
  const formatName = (name: string) => {
    if (!name) return "Unknown";
    return name
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Format phone number for display
  const formatPhoneDisplay = (phone: string) => {
    if (!phone) return "";
    return phone.replace(/^\+?254/, "0");
  };

  // Format message time
  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  // Format date for separator (Today, Yesterday, or full date)
  const formatDateSeparator = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (messageDate.getTime() === today.getTime()) {
      return "Today";
    } else if (messageDate.getTime() === yesterday.getTime()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      });
    }
  };

  // Check if two dates are on different days
  const isDifferentDay = (date1: string, date2: string) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return (
      d1.getFullYear() !== d2.getFullYear() ||
      d1.getMonth() !== d2.getMonth() ||
      d1.getDate() !== d2.getDate()
    );
  };

  // Copy message to clipboard
  const handleCopyMessage = async (message: WhatsAppMessage) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await Clipboard.setString(message.message_body);
      Alert.alert("Copied", "Message copied to clipboard");
      setShowMessageActionMenu(false);
      setSelectedMessageForAction(null);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to copy message");
    }
  };

  // Quick reply templates
  const quickReplyTemplates = [
    "Thank you for your message. We'll get back to you shortly.",
    "We've received your message and will look into it.",
    "Thank you for choosing Airtel. How can we assist you today?",
    "We apologize for the inconvenience. Please call us at 0733100500 for immediate assistance.",
    "Your request has been noted. Our team will contact you soon.",
  ];

  // Handle quick reply selection
  const handleQuickReply = (template: string) => {
    setMessageText(template);
  };

  // Scroll to bottom
  const scrollToBottom = () => {
    chatScrollViewRef.current?.scrollToEnd({ animated: true });
  };

  // Handle scroll position for scroll to bottom button
  const handleScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const isNearBottom =
      contentOffset.y + layoutMeasurement.height >= contentSize.height - 100;
    setShowScrollToBottom(!isNearBottom);
  };

  // Format submission date as "5th nov 2025"
  const formatSubmissionDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const day = date.getDate();
    const monthNames = [
      "jan",
      "feb",
      "mar",
      "apr",
      "may",
      "jun",
      "jul",
      "aug",
      "sep",
      "oct",
      "nov",
      "dec",
    ];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();

    // Add ordinal suffix
    const getOrdinal = (n: number) => {
      const s = ["th", "st", "nd", "rd"];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };

    return `submitted: ${getOrdinal(day)} ${month} ${year}`;
  };

  // Fetch conversations with last message
  const fetchConversations = async (showLoadingState = false) => {
    if (!isSupabaseConfigured) return;

    try {
      if (showLoadingState) setLoading(true);
      const supabase = getSupabaseClient();

      // Fetch customers/leads (limit to 500 for performance, exclude resubmitted)
      let customersQuery = supabase
        .from("leads")
        .select(
          "id, customer_name, installation_town, airtel_number, alternate_number, preferred_package, whatsapp_response, whatsapp_response_date, whatsapp_message_sent_date, created_at, status, source, is_pinned"
        )
        .neq("resubmitted", true) // Exclude resubmitted customers
        .limit(500); // Limit to 500 most recent for performance

      // Search filtering is now done client-side for instant results
      // No need to apply search filter to database query

      // Apply status filter
      if (filter === "yes") {
        customersQuery = customersQuery.eq("whatsapp_response", "yes_received");
      } else if (filter === "no") {
        customersQuery = customersQuery.eq(
          "whatsapp_response",
          "no_not_received"
        );
      } else if (filter === "no_response") {
        customersQuery = customersQuery.or(
          "whatsapp_response.is.null,whatsapp_response.eq.unknown"
        );
      } else if (filter === "registered_today") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        customersQuery = customersQuery
          .gte("created_at", today.toISOString())
          .lt("created_at", tomorrow.toISOString());
      } else if (filter === "registered_this_week") {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        customersQuery = customersQuery.gte(
          "created_at",
          weekAgo.toISOString()
        );
      } else if (filter === "registered_old") {
        // Customers registered more than 7 days ago
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        customersQuery = customersQuery.lt("created_at", weekAgo.toISOString());
      } else if (filter === "new") {
        customersQuery = customersQuery.eq("status", "new");
      } else if (filter === "needs_review") {
        // Filter customers who have messages needing review
        // We'll handle this by checking messages after fetching
      }

      // Fetch fresh data
      const { data: fetchedCustomers, error: customersError } = await customersQuery;
      
      if (customersError) {
        console.error("Error fetching customers:", customersError);
        setAllConversations([]);
        if (showLoadingState) setLoading(false);
        return;
      }
      
      const customers = fetchedCustomers || [];

      // Optimize: Fetch messages more efficiently
      // Only fetch what we need for conversation list (last message + unread count)
      const phoneNumbers = (customers || [])
        .map((c) => {
          const phone = c.alternate_number || c.airtel_number;
          return phone ? formatWhatsAppNumber(phone) : null;
        })
        .filter((p): p is string => p !== null);

      const messagesByPhone = new Map<string, WhatsAppMessage[]>();
      
      if (phoneNumbers.length > 0) {
        // Strategy: Fetch recent messages (last 300) and group by phone
        // This is much faster than fetching all messages for all customers
        const { data: recentMessages } = await supabase
          .from("whatsapp_messages")
          .select("*")
          .in("customer_phone", phoneNumbers)
          .order("created_at", { ascending: false })
          .limit(300); // Only fetch 300 most recent messages across all customers

        // Group messages by phone (keep up to 5 most recent per customer for unread count)
        (recentMessages || []).forEach((msg) => {
          const existing = messagesByPhone.get(msg.customer_phone) || [];
          if (existing.length < 5) { // Keep only last 5 messages per customer
            existing.push(msg);
            messagesByPhone.set(msg.customer_phone, existing);
          }
        });
      }

      // If filtering by needs_review, get phone numbers with flagged messages
      let flaggedPhoneNumbers: Set<string> = new Set();
      if (filter === "needs_review") {
        // Check messages we already fetched
        messagesByPhone.forEach((messages) => {
          messages.forEach((msg) => {
            if (msg.needs_agent_review === true) {
              flaggedPhoneNumbers.add(msg.customer_phone);
            }
          });
        });
      }

      // Filter customers if needs_review is active
      const customersToUse =
        filter === "needs_review"
          ? (customers || []).filter((customer) => {
              const phone =
                customer.alternate_number || customer.airtel_number;
              if (!phone) return false;
              const formattedPhone = formatWhatsAppNumber(phone);
              return flaggedPhoneNumbers.has(formattedPhone);
            })
          : customers || [];

      // If needs_review filter and no matches, return empty
      if (filter === "needs_review" && customersToUse.length === 0) {
        setAllConversations([]);
        if (showLoadingState) setLoading(false);
        return;
      }

      // Build conversations with last message and unread count
      const conversationsWithMessages: Conversation[] = customersToUse.map(
        (customer) => {
          const phoneNumber =
            customer.alternate_number || customer.airtel_number;
          if (!phoneNumber) {
            return {
              customer,
              unreadCount: 0,
            };
          }

          const formattedPhone = formatWhatsAppNumber(phoneNumber);
          const messages = messagesByPhone.get(formattedPhone) || [];

          // Get last message
          const lastMsg = messages[0];

          // Check if customer has messages needing review
          const hasFlaggedMessage = messages.some(
            (m) => m.needs_agent_review === true
          );

          // Count unread messages
          // Unread = inbound messages that are newer than the last outbound message
          // Messages are sorted by created_at DESC (newest first)
          const lastOutbound = messages.find((m) => m.direction === "outbound");
          const unreadCount = lastOutbound
            ? messages.filter(
                (m) =>
                  m.direction === "inbound" &&
                  new Date(m.created_at) > new Date(lastOutbound.created_at)
              ).length
            : messages.filter((m) => m.direction === "inbound").length;

          return {
            customer: {
              ...customer,
              needs_agent_review: hasFlaggedMessage,
              is_pinned: customer.is_pinned === true, // Ensure boolean, default to false
            },
            lastMessage: lastMsg
              ? {
                  body: lastMsg.message_body,
                  timestamp: lastMsg.created_at,
                  direction: lastMsg.direction,
                  type: lastMsg.message_type,
                }
              : undefined,
            unreadCount,
          };
        }
      );

      // Sort: pinned first, then by last message time (most recent first)
      conversationsWithMessages.sort((a, b) => {
        // Pinned conversations first
        const aPinned = a.customer.is_pinned === true;
        const bPinned = b.customer.is_pinned === true;
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;

        // Then sort by last message time
        if (!a.lastMessage && !b.lastMessage) return 0;
        if (!a.lastMessage) return 1;
        if (!b.lastMessage) return -1;
        return (
          new Date(b.lastMessage.timestamp).getTime() -
          new Date(a.lastMessage.timestamp).getTime()
        );
      });

      setAllConversations(conversationsWithMessages);
    } catch (error) {
      console.error("Error:", error);
      setAllConversations([]);
    } finally {
      if (showLoadingState) {
        setLoading(false);
      }
    }
  };

  // Set up Realtime subscriptions for conversation list
  // Only subscribe when NOT in chat view (selectedCustomer is null)
  useEffect(() => {
    if (!isSupabaseConfigured || selectedCustomer) return;

    const supabase = getSupabaseClient();
    const channel1 = supabase
      .channel("messages-leads-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
        },
        () => {
          // Refresh conversation list when leads change
          fetchConversations(false);
        }
      )
      .subscribe();

    const channel2 = supabase
      .channel("messages-whatsapp-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_messages",
        },
        () => {
          // Refresh conversation list when messages change
          fetchConversations(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel1);
      supabase.removeChannel(channel2);
    };
  }, [isSupabaseConfigured, selectedCustomer]);

  // Filter conversations client-side based on search query (instant, no database query)
  const filteredConversations = useMemo(() => {
    let result = allConversations;

    // Apply search filter client-side (instant)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      
      // Generate phone number search patterns
      const getPhoneSearchPatterns = (searchQuery: string): string[] => {
        const digits = searchQuery.replace(/\D/g, "");
        if (digits.length === 0) return [];

        const patterns: string[] = [];
        if (digits.startsWith("0")) {
          patterns.push(digits);
          patterns.push("254" + digits.substring(1));
          patterns.push(digits.substring(1));
        } else if (digits.startsWith("254")) {
          patterns.push(digits);
          patterns.push("0" + digits.substring(3));
          patterns.push(digits.substring(3));
        } else {
          patterns.push(digits);
          patterns.push("0" + digits);
          patterns.push("254" + digits);
        }
        return [...new Set(patterns)];
      };

      const phonePatterns = getPhoneSearchPatterns(searchQuery);

      result = result.filter((conv) => {
        const customer = conv.customer;
        
        // Search in customer name
        if (customer.customer_name?.toLowerCase().includes(query)) {
          return true;
        }

        // Search in installation town
        if (customer.installation_town?.toLowerCase().includes(query)) {
          return true;
        }

        // Search in phone numbers
        const airtelNumber = customer.airtel_number?.toLowerCase() || "";
        const alternateNumber = customer.alternate_number?.toLowerCase() || "";

        if (phonePatterns.length > 0) {
          return phonePatterns.some(
            (pattern) =>
              airtelNumber.includes(pattern.toLowerCase()) ||
              alternateNumber.includes(pattern.toLowerCase())
          );
        } else {
          return airtelNumber.includes(query) || alternateNumber.includes(query);
        }
      });
    }

    return result;
  }, [allConversations, searchQuery]);

  // Only refetch from database when filter changes (not search)
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    setLoading(true);
    
    // Debounce the actual fetch
    const timer = setTimeout(() => {
      fetchConversations(true).finally(() => {
        setLoading(false);
      });
    }, 300); // Reduced debounce since search is now client-side

    return () => {
      clearTimeout(timer);
    };
  }, [filter, isSupabaseConfigured]); // Removed searchQuery - now filtered client-side

  // Handle Android back button when in chat view
  useEffect(() => {
    if (!selectedCustomer) return;

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        setSelectedCustomer(null);
        setChatMessages([]);
        setMessageText("");
        setShowCustomerInfo(false);
        fetchConversations(false);
        return true; // Prevent default back behavior
      }
    );

    return () => backHandler.remove();
  }, [selectedCustomer]);

  // Initial fetch on mount (only when not in chat view)
  useEffect(() => {
    if (!isSupabaseConfigured || selectedCustomer) return;
    fetchConversations(true);
  }, [isSupabaseConfigured]);

  // Fetch chat messages
  const fetchChatMessages = async (customer: Customer) => {
    if (!isSupabaseConfigured) return;

    const phoneNumber = customer.alternate_number || customer.airtel_number;
    if (!phoneNumber) return;

    setChatLoading(true);
    try {
      const supabase = getSupabaseClient();
      const formattedPhone = formatWhatsAppNumber(phoneNumber);

      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("customer_phone", formattedPhone)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching chat messages:", error);
        setChatMessages([]);
      } else {
        setChatMessages(data || []);
        setTimeout(() => {
          chatScrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error) {
      console.error("Error:", error);
      setChatMessages([]);
    } finally {
      setChatLoading(false);
    }
  };

  // Set up Realtime for chat messages
  useEffect(() => {
    if (!isSupabaseConfigured || !selectedCustomer) return;

    const supabase = getSupabaseClient();
    const phoneNumber =
      selectedCustomer.alternate_number || selectedCustomer.airtel_number;
    if (!phoneNumber) return;

    const formattedPhone = formatWhatsAppNumber(phoneNumber);

    const channel = supabase
      .channel(`chat-messages-${selectedCustomer.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_messages",
          filter: `customer_phone=eq.${formattedPhone}`,
        },
        () => {
          fetchChatMessages(selectedCustomer);
          setTimeout(() => {
            chatScrollViewRef.current?.scrollToEnd({ animated: true });
          }, 200);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCustomer]);

  // Handle conversation selection
  const handleSelectConversation = (conversation: Conversation) => {
    if (multiSelectMode) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const newSelected = new Set(selectedIds);
      if (newSelected.has(conversation.customer.id)) {
        newSelected.delete(conversation.customer.id);
      } else {
        newSelected.add(conversation.customer.id);
      }
      setSelectedIds(newSelected);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedCustomer(conversation.customer);
      fetchChatMessages(conversation.customer);
    }
  };

  // Toggle pin status
  const handleTogglePin = async (customer: Customer, event?: any) => {
    if (event) {
      event.stopPropagation();
    }
    if (!isSupabaseConfigured) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Database not configured");
      return;
    }

    try {
      // Haptic feedback when starting pin action
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const supabase = getSupabaseClient();
      const newPinStatus = customer.is_pinned !== true;

      console.log("Toggling pin:", {
        customerId: customer.id,
        currentStatus: customer.is_pinned,
        newStatus: newPinStatus,
      });

      const { data, error } = await supabase
        .from("leads")
        .update({ is_pinned: newPinStatus })
        .eq("id", customer.id)
        .select("id, is_pinned");

      if (error) {
        console.error("Pin toggle error:", error);
        console.error("Error details:", JSON.stringify(error, null, 2));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          "Error",
          `Failed to update pin status: ${error.message || "Unknown error"}\n\nCode: ${error.code || "N/A"}\n\nMake sure you've run the database migration to add the is_pinned field.`
        );
        return;
      }

      console.log("Pin update response:", data);
      console.log("Pin updated successfully - new status:", newPinStatus);
      
      // Success haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Close the long-press menu
      setLongPressedConversation(null);
      
      // Update the customer object in state if it's currently selected
      if (selectedCustomer && selectedCustomer.id === customer.id) {
        setSelectedCustomer({
          ...selectedCustomer,
          is_pinned: newPinStatus,
        });
      }
      
      // Refresh conversations to reflect the change
      await fetchConversations(false);
    } catch (error: any) {
      console.error("Pin toggle exception:", error);
      console.error("Exception details:", JSON.stringify(error, null, 2));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Error",
        `Failed to update pin status: ${error?.message || "Unknown error"}\n\nMake sure you've run the database migration.`
      );
    }
  };

  // Toggle multi-select mode
  const toggleMultiSelect = () => {
    setMultiSelectMode(!multiSelectMode);
    setSelectedIds(new Set());
  };

  // Select all / Deselect all
  const handleSelectAll = () => {
    if (selectedIds.size === filteredConversations.length) {
      // Deselect all
      setSelectedIds(new Set());
    } else {
      // Select all
      setSelectedIds(new Set(filteredConversations.map((c) => c.customer.id)));
    }
  };

  // Send batch template messages
  const handleBatchSend = async () => {
    if (selectedIds.size === 0) {
      Alert.alert("No Selection", "Please select at least one customer");
      return;
    }

    const selectedCustomers = conversations
      .filter((c) => selectedIds.has(c.customer.id))
      .map((c) => c.customer);

    Alert.alert(
      "Send Template Message",
      `Send verification template to ${selectedCustomers.length} customer(s)?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send",
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setSendingBatch(true);
            let successCount = 0;
            let failCount = 0;

            for (const customer of selectedCustomers) {
              const phoneNumber =
                customer.alternate_number || customer.airtel_number;
              if (!phoneNumber) {
                failCount++;
                continue;
              }

              try {
                const formattedPhone = formatWhatsAppNumber(phoneNumber);
                const customerName = formatName(customer.customer_name);
                const packageType = customer.preferred_package || "Standard";

                const result = await sendWhatsAppMessage({
                  to: formattedPhone,
                  contentSid: WHATSAPP_TEMPLATE_SID,
                  contentVariables: {
                    "1": customerName,
                    "2": packageType,
                  },
                });

                if (result.success) {
                  successCount++;
                } else {
                  failCount++;
                }
              } catch (error) {
                failCount++;
              }
            }

            setSendingBatch(false);
            setMultiSelectMode(false);
            setSelectedIds(new Set());

            // Haptic feedback based on results
            if (failCount === 0) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else if (successCount === 0) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            } else {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }

            Alert.alert(
              "Batch Send Complete",
              `Sent: ${successCount}\nFailed: ${failCount}`
            );
          },
        },
      ]
    );
  };

  // Send text message
  const handleSendTextMessage = async () => {
    if (!selectedCustomer || !messageText.trim()) return;

    const phoneNumber =
      selectedCustomer.alternate_number || selectedCustomer.airtel_number;
    if (!phoneNumber) {
      Alert.alert("Error", "Customer does not have a phone number");
      return;
    }

    setSendingText(true);
    try {
      const formattedPhone = formatWhatsAppNumber(phoneNumber);
      const result = await sendWhatsAppTextMessage({
        to: formattedPhone,
        body: messageText.trim(),
      });

      if (result.success) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setMessageText("");
        await fetchChatMessages(selectedCustomer);
        // Also refresh conversation list to update last message preview
        fetchConversations(false);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Error", result.error || "Failed to send message");
      }
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", error.message || "Failed to send message");
    } finally {
      setSendingText(false);
    }
  };

  // Send template message
  const handleSendTemplate = async (customer: Customer) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const phoneNumber = customer.alternate_number || customer.airtel_number;
    if (!phoneNumber) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Customer does not have a phone number");
      return;
    }

    const formattedPhone = formatWhatsAppNumber(phoneNumber);
    const customerName = formatName(customer.customer_name);
    const packageType = customer.preferred_package || "Standard";

    try {
      const result = await sendWhatsAppMessage({
        to: formattedPhone,
        contentSid: WHATSAPP_TEMPLATE_SID,
        contentVariables: {
          "1": customerName,
          "2": packageType,
        },
      });

      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Success", "Template message sent!");
        if (selectedCustomer?.id === customer.id) {
          await fetchChatMessages(customer);
        }
        // Refresh conversation list to update last message preview
        fetchConversations(false);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Error", result.error || "Failed to send message");
      }
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", error.message || "Failed to send message");
    }
  };

  // Update customer details
  const handleUpdateCustomer = async () => {
    if (!editingCustomer) return;

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("leads")
        .update({
          customer_name: editingCustomer.customer_name,
          status: null, // Remove 'new' status
        })
        .eq("id", editingCustomer.id);

      if (error) {
        Alert.alert("Error", "Failed to update customer");
      } else {
        Alert.alert("Success", "Customer updated!");
        setShowCustomerInfo(false);
        setEditingCustomer(null);
        if (selectedCustomer) {
          const updated = { ...selectedCustomer, ...editingCustomer };
          setSelectedCustomer(updated);
        }
        fetchConversations(false);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to update customer");
    }
  };

  // Get status badge
  const getStatusBadge = (customer: Customer) => {
    // Check for "New" status first
    if (customer.status === "new" || customer.source === "whatsapp_inbound") {
      return { label: "New", color: "#FBBF24", bgColor: "#FEF3C7" };
    }
    // Check for explicit responses
    if (customer.whatsapp_response === "yes_received") {
      return { label: "Yes", color: "#10B981", bgColor: "#D1FAE5" };
    }
    if (customer.whatsapp_response === "no_not_received") {
      return { label: "No", color: "#EF4444", bgColor: "#FEE2E2" };
    }
    // Only show "Pending" if message was sent but no response
    if (customer.whatsapp_message_sent_date && !customer.whatsapp_response) {
      return { label: "Pending", color: "#6B7280", bgColor: "#F3F4F6" };
    }
    // No badge if no message sent yet
    return null;
  };

  // Show chat view
  if (selectedCustomer) {
    const statusBadge = getStatusBadge(selectedCustomer);
    const phoneNumber =
      selectedCustomer.alternate_number || selectedCustomer.airtel_number;

    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          {/* Chat Header */}
          <View style={styles.chatHeader}>
            <TouchableOpacity
              onPress={() => {
                setSelectedCustomer(null);
                setChatMessages([]);
                setMessageText("");
                setShowCustomerInfo(false);
                // Refresh conversation list when going back
                fetchConversations(false);
              }}
              style={styles.backButton}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.chatHeaderInfo}
              onPress={() => {
                setEditingCustomer(selectedCustomer);
                setShowCustomerInfo(true);
              }}
            >
              <Text style={styles.chatHeaderName}>
                {formatName(selectedCustomer.customer_name)}
              </Text>
              {phoneNumber && (
                <Text style={styles.chatHeaderPhone}>
                  {formatPhoneDisplay(phoneNumber)}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleSendTemplate(selectedCustomer)}
              style={styles.chatHeaderButton}
            >
              <Ionicons name="document-text" size={20} color="#FFD700" />
            </TouchableOpacity>
          </View>

          {/* Messages List */}
          {chatLoading && chatMessages.length === 0 ? (
            <View style={styles.chatLoadingContainer}>
              <ActivityIndicator size="large" color="#FFD700" />
            </View>
          ) : (
            <ScrollView
              ref={chatScrollViewRef}
              style={styles.chatMessages}
              contentContainerStyle={styles.chatMessagesContent}
              showsVerticalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
              {chatMessages.length === 0 ? (
                <View style={styles.chatEmptyContainer}>
                  <Ionicons
                    name="chatbubbles-outline"
                    size={64}
                    color="#4B5563"
                  />
                  <Text style={styles.chatEmptyText}>No messages yet</Text>
                  <Text style={styles.chatEmptySubtext}>
                    Start the conversation
                  </Text>
                </View>
              ) : (
                chatMessages.map((message, index) => {
                  const isOutbound = message.direction === "outbound";
                  const status = message.status || "sent";
                  const prevMessage = index > 0 ? chatMessages[index - 1] : null;
                  const showDateSeparator =
                    !prevMessage ||
                    isDifferentDay(message.created_at, prevMessage.created_at);

                  const getReadReceiptIcon = () => {
                    if (!isOutbound) return null;

                    if (status === "read") {
                      return (
                        <View style={styles.readReceiptContainer}>
                          <Ionicons
                            name="checkmark-done"
                            size={14}
                            color="#4FC3F7"
                          />
                          <Ionicons
                            name="checkmark-done"
                            size={14}
                            color="#4FC3F7"
                            style={{ marginLeft: -6 }}
                          />
                        </View>
                      );
                    } else if (status === "delivered") {
                      return (
                        <View style={styles.readReceiptContainer}>
                          <Ionicons
                            name="checkmark-done"
                            size={14}
                            color="#9CA3AF"
                          />
                          <Ionicons
                            name="checkmark-done"
                            size={14}
                            color="#9CA3AF"
                            style={{ marginLeft: -6 }}
                          />
                        </View>
                      );
                    } else {
                      return (
                        <View style={styles.readReceiptContainer}>
                          <Ionicons
                            name="checkmark"
                            size={14}
                            color="#9CA3AF"
                          />
                        </View>
                      );
                    }
                  };

                  return (
                    <View key={message.id}>
                      {showDateSeparator && (
                        <View style={styles.dateSeparator}>
                          <View style={styles.dateSeparatorLine} />
                          <Text style={styles.dateSeparatorText}>
                            {formatDateSeparator(message.created_at)}
                          </Text>
                          <View style={styles.dateSeparatorLine} />
                        </View>
                      )}
                      <TouchableOpacity
                        onLongPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          setSelectedMessageForAction(message);
                          setShowMessageActionMenu(true);
                        }}
                        activeOpacity={0.9}
                      >
                        <View
                          style={[
                            styles.messageBubble,
                            isOutbound
                              ? styles.messageBubbleOutbound
                              : styles.messageBubbleInbound,
                          ]}
                        >
                          {message.is_ai_response && (
                            <View style={styles.aiBadge}>
                              <Ionicons name="sparkles" size={12} color="#0A0A0A" />
                              <Text style={styles.aiBadgeText}>AI</Text>
                            </View>
                          )}
                          <Text
                            style={[
                              styles.messageText,
                              isOutbound
                                ? styles.messageTextOutbound
                                : styles.messageTextInbound,
                            ]}
                          >
                            {message.message_body}
                          </Text>
                          {message.message_type === "button_click" &&
                            message.button_text && (
                              <Text
                                style={[
                                  styles.messageText,
                                  isOutbound
                                    ? styles.messageTextOutbound
                                    : styles.messageTextInbound,
                                  { fontStyle: "italic", marginTop: 4 },
                                ]}
                              >
                                {message.button_text}
                              </Text>
                            )}
                          <View style={styles.messageFooter}>
                            <Text
                              style={[
                                styles.messageTime,
                                isOutbound
                                  ? styles.messageTimeOutbound
                                  : styles.messageTimeInbound,
                              ]}
                            >
                              {formatMessageTime(message.created_at)}
                            </Text>
                            {getReadReceiptIcon()}
                          </View>
                        </View>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}

          {/* Scroll to Bottom Button */}
          {showScrollToBottom && (
            <TouchableOpacity
              style={styles.scrollToBottomButton}
              onPress={scrollToBottom}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-down" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          {/* Quick Reply Templates */}
          {chatMessages.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.quickReplyContainer}
              contentContainerStyle={styles.quickReplyContent}
            >
              {quickReplyTemplates.map((template, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.quickReplyChip}
                  onPress={() => handleQuickReply(template)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.quickReplyText} numberOfLines={1}>
                    {template}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Message Input */}
          <View
            style={[
              styles.messageInputContainer,
              { paddingBottom: messageInputBottomPadding },
            ]}
          >
            <TextInput
              style={styles.messageInput}
              placeholder="Type a message..."
              placeholderTextColor="#6B7280"
              value={messageText}
              onChangeText={setMessageText}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[
                styles.sendButtonChat,
                (!messageText.trim() || sendingText) &&
                  styles.sendButtonChatDisabled,
              ]}
              onPress={handleSendTextMessage}
              disabled={!messageText.trim() || sendingText}
            >
              {sendingText ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="send" size={20} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>

          {/* Message Action Menu */}
          <Modal
            visible={showMessageActionMenu}
            transparent
            animationType="fade"
            onRequestClose={() => {
              setShowMessageActionMenu(false);
              setSelectedMessageForAction(null);
            }}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => {
                setShowMessageActionMenu(false);
                setSelectedMessageForAction(null);
              }}
            >
              <View style={styles.messageActionMenu}>
                <TouchableOpacity
                  style={styles.messageActionItem}
                  onPress={() => {
                    if (selectedMessageForAction) {
                      handleCopyMessage(selectedMessageForAction);
                    }
                  }}
                >
                  <Ionicons name="copy-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.messageActionText}>Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.messageActionItem}
                  onPress={() => {
                    setShowMessageActionMenu(false);
                    setSelectedMessageForAction(null);
                  }}
                >
                  <Ionicons name="close" size={20} color="#9CA3AF" />
                  <Text style={[styles.messageActionText, { color: "#9CA3AF" }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>

          {/* Customer Info Panel */}
          <Modal
            visible={showCustomerInfo}
            transparent
            animationType="fade"
            onRequestClose={() => setShowCustomerInfo(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setShowCustomerInfo(false)}
            >
              <Animated.View
                style={[
                  styles.customerInfoPanel,
                  {
                    transform: [
                      {
                        translateY: slideAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [400, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={styles.customerInfoHeader}>
                  <Text style={styles.customerInfoTitle}>Customer Info</Text>
                  <TouchableOpacity
                    onPress={() => setShowCustomerInfo(false)}
                    style={styles.closeButton}
                  >
                    <Ionicons name="close" size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.customerInfoContent}>
                  <View style={styles.customerInfoField}>
                    <Text style={styles.customerInfoLabel}>Name</Text>
                    <TextInput
                      style={styles.customerInfoInput}
                      value={editingCustomer?.customer_name || ""}
                      onChangeText={(text) =>
                        setEditingCustomer({
                          ...editingCustomer!,
                          customer_name: text,
                        })
                      }
                      placeholder="Enter customer name"
                      placeholderTextColor="#6B7280"
                    />
                  </View>

                  {phoneNumber && (
                    <View style={styles.customerInfoField}>
                      <Text style={styles.customerInfoLabel}>Phone</Text>
                      <Text style={styles.customerInfoValue}>
                        {formatPhoneDisplay(phoneNumber)}
                      </Text>
                    </View>
                  )}

                  {selectedCustomer.installation_town && (
                    <View style={styles.customerInfoField}>
                      <Text style={styles.customerInfoLabel}>Town</Text>
                      <Text style={styles.customerInfoValue}>
                        {selectedCustomer.installation_town}
                      </Text>
                    </View>
                  )}

                  {selectedCustomer.preferred_package && (
                    <View style={styles.customerInfoField}>
                      <Text style={styles.customerInfoLabel}>Package</Text>
                      <Text style={styles.customerInfoValue}>
                        {selectedCustomer.preferred_package}
                      </Text>
                    </View>
                  )}

                  {statusBadge && (
                    <View style={styles.customerInfoField}>
                      <Text style={styles.customerInfoLabel}>Status</Text>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: statusBadge.bgColor },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            { color: statusBadge.color },
                          ]}
                        >
                          {statusBadge.label}
                        </Text>
                      </View>
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleUpdateCustomer}
                  >
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  </TouchableOpacity>
                </ScrollView>
              </Animated.View>
            </TouchableOpacity>
          </Modal>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Show conversation list
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={styles.headerActions}>
          {multiSelectMode ? (
            <>
              <TouchableOpacity
                onPress={toggleMultiSelect}
                style={styles.headerButton}
              >
                <Text style={styles.headerButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSelectAll}
                style={styles.headerButton}
              >
                <Text style={styles.headerButtonText}>
                  {selectedIds.size === filteredConversations.length
                    ? "Deselect All"
                    : "Select All"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleBatchSend}
                style={[
                  styles.headerButton,
                  selectedIds.size === 0 && styles.headerButtonDisabled,
                ]}
                disabled={selectedIds.size === 0 || sendingBatch}
              >
                {sendingBatch ? (
                  <ActivityIndicator size="small" color="#FFD700" />
                ) : (
                  <Text style={styles.headerButtonText}>
                    Send ({selectedIds.size})
                  </Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              onPress={toggleMultiSelect}
              style={styles.headerButton}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={24}
                color="#FFD700"
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersContainer}
        contentContainerStyle={styles.filtersContent}
      >
        {[
          { key: "all", label: "All" },
          { key: "yes", label: "Yes" },
          { key: "no", label: "No" },
          { key: "no_response", label: "No Response" },
          { key: "needs_review", label: "Needs Review" },
          { key: "registered_today", label: "Today" },
          { key: "registered_this_week", label: "This Week" },
          { key: "registered_old", label: "Old" },
          { key: "new", label: "New" },
        ].map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.filterChip,
              filter === f.key && styles.filterChipActive,
            ]}
            onPress={() => setFilter(f.key as FilterType)}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === f.key && styles.filterChipTextActive,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        {searching ? (
          <ActivityIndicator
            size="small"
            color="#FFD700"
            style={styles.searchIcon}
          />
        ) : (
          <Ionicons
            name="search"
            size={20}
            color="#9CA3AF"
            style={styles.searchIcon}
          />
        )}
        <TextInput
          style={styles.searchInput}
          placeholder="Search..."
          placeholderTextColor="#6B7280"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery("")}
            style={styles.clearButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Conversations List */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await fetchConversations(false);
              setRefreshing(false);
            }}
            tintColor="#FFD700"
          />
        }
      >
        {loading && allConversations.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFD700" />
            <Text style={styles.loadingText}>Loading conversations...</Text>
          </View>
        ) : filteredConversations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color="#4B5563" />
            <Text style={styles.emptyText}>No conversations</Text>
            <Text style={styles.emptySubtext}>
              {searchQuery
                ? "Try adjusting your search"
                : "Start a conversation"}
            </Text>
          </View>
        ) : (
          filteredConversations.map((conversation) => {
            const isSelected = selectedIds.has(conversation.customer.id);
            const statusBadge = getStatusBadge(conversation.customer);
            const phoneNumber =
              conversation.customer.alternate_number ||
              conversation.customer.airtel_number;

            const hasUnread = conversation.unreadCount > 0;

            return (
              <TouchableOpacity
                key={conversation.customer.id}
                style={[
                  styles.conversationRow,
                  hasUnread && styles.conversationRowUnread,
                  isSelected &&
                    (hasUnread
                      ? styles.conversationRowSelectedUnread
                      : styles.conversationRowSelected),
                ]}
                onPress={() => {
                  if (longPressedConversation === conversation.customer.id) {
                    setLongPressedConversation(null);
                  } else {
                    handleSelectConversation(conversation);
                  }
                }}
                onLongPress={() => {
                  if (!multiSelectMode) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setLongPressedConversation(conversation.customer.id);
                  }
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {multiSelectMode && (
                  <View style={styles.checkboxContainer}>
                    <View
                      style={[
                        styles.checkbox,
                        isSelected && styles.checkboxChecked,
                      ]}
                    >
                      {isSelected && (
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      )}
                    </View>
                  </View>
                )}

                <View style={styles.conversationContent}>
                  <View style={styles.conversationHeader}>
                    <View style={styles.conversationNameContainer}>
                      <View style={styles.conversationNameRow}>
                        <Text
                          style={[
                            styles.conversationName,
                            conversation.unreadCount > 0 &&
                              styles.conversationNameUnread,
                          ]}
                          numberOfLines={1}
                        >
                          {formatName(conversation.customer.customer_name)}
                        </Text>
                        {conversation.customer.is_pinned === true && 
                         longPressedConversation !== conversation.customer.id && (
                          <Image
                            source={require("../../assets/images/pin.png")}
                            style={styles.pinIcon}
                            resizeMode="contain"
                          />
                        )}
                        {conversation.unreadCount > 0 && (
                          <View style={styles.unreadDot} />
                        )}
                      </View>
                      {!multiSelectMode && longPressedConversation === conversation.customer.id && (
                        <View style={styles.conversationActions}>
                          <TouchableOpacity
                            onPress={async (e) => {
                              e.stopPropagation();
                              await handleTogglePin(conversation.customer, e);
                            }}
                            style={styles.pinButton}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Image
                              source={require("../../assets/images/pin.png")}
                              style={[
                                styles.pinButtonIcon,
                                conversation.customer.is_pinned === true && styles.pinButtonIconActive
                              ]}
                              resizeMode="contain"
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => setLongPressedConversation(null)}
                            style={styles.closeActionButton}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="close" size={16} color="#9CA3AF" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                    {conversation.lastMessage && (
                      <Text
                        style={[
                          styles.conversationTime,
                          conversation.unreadCount > 0 &&
                            styles.conversationTimeUnread,
                        ]}
                      >
                        {formatMessageTime(conversation.lastMessage.timestamp)}
                      </Text>
                    )}
                  </View>

                  <View style={styles.conversationFooter}>
                    <View style={styles.conversationPreviewContainer}>
                      {conversation.lastMessage ? (
                        <Text
                          style={[
                            styles.conversationPreview,
                            conversation.unreadCount > 0 &&
                              styles.conversationPreviewUnread,
                          ]}
                          numberOfLines={1}
                        >
                          {conversation.lastMessage.direction === "outbound" &&
                            "You: "}
                          {conversation.lastMessage.body}
                        </Text>
                      ) : (
                        <Text
                          style={[
                            styles.conversationPreview,
                            conversation.unreadCount > 0 &&
                              styles.conversationPreviewUnread,
                          ]}
                          numberOfLines={1}
                        >
                          {phoneNumber
                            ? formatPhoneDisplay(phoneNumber)
                            : "No phone number"}
                        </Text>
                      )}
                      {conversation.customer.created_at && (
                        <Text style={styles.submissionDate}>
                          {formatSubmissionDate(
                            conversation.customer.created_at
                          )}
                        </Text>
                      )}
                    </View>

                    <View style={styles.conversationBadges}>
                      {conversation.unreadCount > 0 && (
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadBadgeText}>
                            {conversation.unreadCount > 99
                              ? "99+"
                              : conversation.unreadCount}
                          </Text>
                        </View>
                      )}
                      {conversation.customer.needs_agent_review && (
                        <View
                          style={[
                            styles.statusBadgeSmall,
                            { backgroundColor: "#FEF3C7", marginRight: 6 },
                          ]}
                        >
                          <Ionicons
                            name="flag"
                            size={10}
                            color="#F59E0B"
                            style={{ marginRight: 2 }}
                          />
                          <Text
                            style={[
                              styles.statusBadgeTextSmall,
                              { color: "#F59E0B" },
                            ]}
                          >
                            Review
                          </Text>
                        </View>
                      )}
                      {statusBadge && !hasUnread && (
                        <View
                          style={[
                            styles.statusBadgeSmall,
                            { backgroundColor: statusBadge.bgColor },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeTextSmall,
                              { color: statusBadge.color },
                            ]}
                          >
                            {statusBadge.label}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1F1F1F",
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Montserrat_600SemiBold",
    color: "#FFD700",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerButtonDisabled: {
    opacity: 0.5,
  },
  headerButtonText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#FFD700",
  },
  filtersContainer: {
    maxHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: "#1F1F1F",
  },
  filtersContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#1A1A1A",
    borderWidth: 2,
    borderColor: "#2A2A2A",
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: "#FFD700",
    borderColor: "#FFD700",
    borderWidth: 2,
  },
  filterChipText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#9CA3AF",
  },
  filterChipTextActive: {
    color: "#0A0A0A",
    fontFamily: "Inter_700Bold",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1F1F1F",
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#FFFFFF",
  },
  clearButton: {
    marginLeft: 12,
    padding: 4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 62, // Add bottom padding to avoid tab bar
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#9CA3AF",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: "#9CA3AF",
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
  },
  conversationRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1F1F1F",
    backgroundColor: "#0A0A0A",
  },
  conversationRowUnread: {
    backgroundColor: "#1F1F1F",
    borderLeftWidth: 4,
    borderLeftColor: "#FFD700",
    paddingLeft: 12, // 16 - 4 to maintain spacing
    borderBottomColor: "#2A2A2A",
  },
  conversationRowSelected: {
    backgroundColor: "#2A2A2A",
  },
  conversationRowSelectedUnread: {
    backgroundColor: "#2F2F2F",
    borderLeftWidth: 4,
    borderLeftColor: "#FFD700",
  },
  checkboxContainer: {
    justifyContent: "center",
    marginRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#9CA3AF",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: "#FFD700",
    borderColor: "#FFD700",
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  conversationNameContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginRight: 8,
  },
  conversationNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 6,
  },
  pinIcon: {
    width: 14,
    height: 14,
    marginLeft: 4,
  },
  pinButtonIcon: {
    width: 18,
    height: 18,
    opacity: 0.6,
  },
  pinButtonIconActive: {
    opacity: 1,
  },
  conversationActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 8,
  },
  pinButton: {
    padding: 6,
  },
  closeActionButton: {
    padding: 4,
  },
  conversationName: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  conversationNameUnread: {
    fontFamily: "Inter_700Bold",
    color: "#FFD700",
    fontSize: 17,
  },
  conversationTime: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
  },
  conversationTimeUnread: {
    color: "#FFD700",
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FFD700",
    marginLeft: 8,
    borderWidth: 2,
    borderColor: "#0A0A0A",
  },
  conversationFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  conversationPreviewContainer: {
    flex: 1,
    marginRight: 8,
  },
  conversationPreview: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#9CA3AF",
    marginBottom: 2,
  },
  conversationPreviewUnread: {
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
    fontSize: 15,
  },
  submissionDate: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
    marginTop: 2,
  },
  conversationBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  unreadBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFD700",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
    borderWidth: 2,
    borderColor: "#0A0A0A",
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  unreadBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#0A0A0A",
  },
  statusBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusBadgeTextSmall: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  // Chat view styles
  flex: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#1A1A1A",
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2A",
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
    marginRight: 12,
  },
  chatHeaderInfo: {
    flex: 1,
  },
  chatHeaderName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFD700",
    marginBottom: 2,
  },
  chatHeaderPhone: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#9CA3AF",
  },
  chatHeaderButton: {
    padding: 8,
  },
  chatMessages: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },
  chatMessagesContent: {
    padding: 16,
    paddingBottom: 20,
  },
  chatLoadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  chatEmptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  chatEmptyText: {
    marginTop: 16,
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: "#9CA3AF",
  },
  chatEmptySubtext: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
    textAlign: "center",
  },
  messageBubble: {
    maxWidth: "75%",
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  messageBubbleInbound: {
    alignSelf: "flex-start",
    backgroundColor: "#1F1F1F",
    borderTopLeftRadius: 4,
  },
  messageBubbleOutbound: {
    alignSelf: "flex-end",
    backgroundColor: "#FFD700",
    borderTopRightRadius: 4,
  },
  messageText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    marginBottom: 4,
  },
  messageTextInbound: {
    color: "#FFFFFF",
  },
  messageTextOutbound: {
    color: "#0A0A0A",
  },
  messageTime: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  messageTimeInbound: {
    color: "#6B7280",
  },
  messageTimeOutbound: {
    color: "#4B5563",
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  readReceiptContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 6,
  },
  messageInputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#1A1A1A",
    borderTopWidth: 1,
    borderTopColor: "#2A2A2A",
  },
  messageInput: {
    flex: 1,
    maxHeight: 100,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#FFFFFF",
    backgroundColor: "#2A2A2A",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
  },
  sendButtonChat: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFD700",
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonChatDisabled: {
    backgroundColor: "#4B5563",
    opacity: 0.5,
  },
  // Customer Info Panel
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  customerInfoPanel: {
    backgroundColor: "#1A1A1A",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingBottom: 40,
  },
  customerInfoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2A",
  },
  customerInfoTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  closeButton: {
    padding: 4,
  },
  customerInfoContent: {
    padding: 20,
  },
  customerInfoField: {
    marginBottom: 20,
  },
  customerInfoLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#9CA3AF",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  customerInfoInput: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#FFFFFF",
    backgroundColor: "#2A2A2A",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#3A3A3A",
  },
  customerInfoValue: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#FFFFFF",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  statusBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  saveButton: {
    backgroundColor: "#FFD700",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 20,
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#0A0A0A",
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#FFD700",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 4,
    gap: 4,
  },
  aiBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#0A0A0A",
  },
  // Date separator
  dateSeparator: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  dateSeparatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#2A2A2A",
  },
  dateSeparatorText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#9CA3AF",
    marginHorizontal: 12,
  },
  // Scroll to bottom button
  scrollToBottomButton: {
    position: "absolute",
    bottom: 100,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFD700",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  // Quick reply templates
  quickReplyContainer: {
    maxHeight: 60,
    borderTopWidth: 1,
    borderTopColor: "#1F1F1F",
    backgroundColor: "#0A0A0A",
  },
  quickReplyContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  quickReplyChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#1F1F1F",
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  quickReplyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#FFFFFF",
    maxWidth: 200,
  },
  // Message action menu
  messageActionMenu: {
    backgroundColor: "#1A1A1A",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 12,
    paddingBottom: 20,
  },
  messageActionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  messageActionText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#FFFFFF",
  },
});
