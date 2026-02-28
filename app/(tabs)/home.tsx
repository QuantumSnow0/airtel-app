import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { File, Paths } from "expo-file-system";
import * as Notifications from "expo-notifications";
import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { Calendar } from "react-native-calendars";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import * as XLSX from "xlsx";
import { dataPreloader } from "../../lib/dataPreloader";
import { getSupabaseClient, isSupabaseConfigured } from "../../lib/supabase";
import { handleSupabaseError } from "../../lib/supabase-error-handler";

interface Lead {
  id: string;
  customer_name: string;
  airtel_number: string;
  alternate_number: string;
  email?: string;
  preferred_package?: string;
  installation_town?: string;
  delivery_landmark?: string;
  visit_date?: string;
  visit_time?: string;
  agent_type?: string;
  enterprise_cp?: string;
  agent_name?: string;
  agent_mobile?: string;
  lead_type?: string;
  connection_type?: string;
  created_at: string;
  bypass_duplicate_check?: boolean;
  resubmitted?: boolean;
}

export default function HomeScreen() {
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [todayCount, setTodayCount] = useState<number | null>(null);
  const [yesterdayCount, setYesterdayCount] = useState<number | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedNumberId, setCopiedNumberId] = useState<string | null>(null);
  const [dailyData, setDailyData] = useState<{ date: string; count: number }[]>([]);
  const [graphDateRange, setGraphDateRange] = useState<"7d" | "30d" | "90d" | "custom">("7d");
  const [graphLoading, setGraphLoading] = useState(false);
  const graphRequestIdRef = useRef(0);
  const loadingBarAnimation = useRef(new Animated.Value(0)).current;

  // Animate loading bar when graphLoading changes
  useEffect(() => {
    if (graphLoading) {
      // Start animation loop
      const animate = () => {
        Animated.sequence([
          Animated.timing(loadingBarAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: false,
          }),
          Animated.timing(loadingBarAnimation, {
            toValue: 0,
            duration: 0,
            useNativeDriver: false,
          }),
        ]).start(() => {
          if (graphLoading) {
            animate();
          }
        });
      };
      animate();
    } else {
      loadingBarAnimation.setValue(0);
    }
  }, [graphLoading, loadingBarAnimation]);
  const [duplicateStatus, setDuplicateStatus] = useState<{
    [key: string]: "red" | "orange" | null;
  }>({});
  const [duplicateCount, setDuplicateCount] = useState<number>(0);
  const [todayDuplicateCount, setTodayDuplicateCount] = useState<number>(0);
  const [exporting, setExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedTown, setSelectedTown] = useState<string | null>(null); // null = All towns
  const [dateFilter, setDateFilter] = useState<"today" | "all" | "custom">(
    "all"
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null); // YYYY-MM-DD format
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [availableTowns, setAvailableTowns] = useState<string[]>([]);
  const [showTownList, setShowTownList] = useState(false);
  const [pendingExportOption, setPendingExportOption] = useState<
    "full" | "airtel" | "alternate" | null
  >(null);
  
  // Monthly progress state
  const TARGET_MONTHLY = 1000;
  const [currentMonthCount, setCurrentMonthCount] = useState<number | null>(null);
  const [monthLoading, setMonthLoading] = useState(false);
  // Celebration state - show if target is achieved for current month
  const [showCelebration, setShowCelebration] = useState(false);
  const celebrationOpacity = useRef(new Animated.Value(0)).current;
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const selectedMonthRef = useRef(selectedMonth);
  const progressAnimation = useRef(new Animated.Value(0)).current;
  
  // Keep ref in sync with state
  useEffect(() => {
    selectedMonthRef.current = selectedMonth;
  }, [selectedMonth]);

  // Fetch available towns for filter
  const fetchTowns = useCallback(async () => {
    console.log(
      "🔍 fetchTowns called, isSupabaseConfigured:",
      isSupabaseConfigured
    );
    if (!isSupabaseConfigured) {
      console.log("⚠️ Supabase not configured, skipping town fetch");
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
        handleSupabaseError(error);
        setAvailableTowns([]);
      } else {
        // Get unique towns
        const uniqueTowns = Array.from(
          new Set(data?.map((item) => item.installation_town) || [])
        ).filter((town) => town && town.trim() !== "");
        setAvailableTowns(uniqueTowns);
      }
    } catch (error) {
      console.error("❌ Exception in fetchTowns:", error);
      setAvailableTowns([]);
    }
  }, []);

  // Fetch towns on mount - separate useEffect
  useEffect(() => {
    console.log("🚀 Component mounted, calling fetchTowns...");
    fetchTowns();
  }, [fetchTowns]);

  useEffect(() => {
    // Request notification permissions
    const setupNotifications = async () => {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.log("Notification permissions not granted");
        return;
      }

      // Configure notification handler
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    };

    setupNotifications();

    if (isSupabaseConfigured) {
      // Check if data was preloaded
      const preloadedData = dataPreloader.getHomeData();

      if (preloadedData) {
        // Use preloaded data immediately - no loading state needed!
        setTotalCount(preloadedData.totalCount);
        setTodayCount(preloadedData.todayCount);
        setYesterdayCount(preloadedData.yesterdayCount);
        setLeads(preloadedData.leads);
        setLoading(false);
        console.log("Using preloaded home data - instant load!");
      } else {
        // Data not preloaded yet, fetch normally
        fetchCounts();
      }

      // Initialize monthly progress
      fetchMonthCount(selectedMonth.year, selectedMonth.month, false);

      // Set up Realtime subscription
      const supabase = getSupabaseClient();
      console.log("🔌 Setting up realtime subscription for leads table...");
      const channel = supabase
        .channel("leads-changes")
        .on(
          "postgres_changes",
          {
            event: "INSERT", // Only listen to INSERT events for new customers
            schema: "public",
            table: "leads",
          },
          async (payload) => {
            const newLead = payload.new as Lead;

            // Check if the new customer was registered today
            const leadDate = new Date(newLead.created_at);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            leadDate.setHours(0, 0, 0, 0);

            if (leadDate.getTime() === today.getTime()) {
              // New customer registered today - send notification
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: "New Customer Registered! 🎉",
                  body: `${newLead.customer_name || "A new customer"} just signed up today`,
                  sound: true,
                  data: { leadId: newLead.id },
                },
                trigger: null, // Show immediately
              });
            }

            console.log("🔄 New lead inserted, refreshing counts...", {
              leadId: newLead.id,
              customerName: newLead.customer_name,
              createdAt: newLead.created_at
            });
            
            try {
              // Refetch counts when any change occurs (without showing loading)
              // This updates totalCount via calculateTotalFromAllMonths()
              await fetchCounts(false);
              console.log("✅ fetchCounts completed, totalCount should be updated");
              
              // Always refresh the current month (today's month) when new leads are added
              // This ensures the monthly count updates in real-time
              const now = new Date();
              const currentYear = now.getFullYear();
              const currentMonth = now.getMonth();
              
              // Check if the new lead is from the current month
              const leadDate = new Date(newLead.created_at);
              if (leadDate.getFullYear() === currentYear && leadDate.getMonth() === currentMonth) {
                console.log("📅 New lead is from current month, refreshing current month count");
                await fetchMonthCount(currentYear, currentMonth, false);
                console.log("✅ Current month count refreshed");
              }
              
              // Also refresh the selected month if it's different from current month
              // This ensures the UI stays in sync if user is viewing a different month
              const currentSelectedMonth = selectedMonthRef.current;
              if (currentSelectedMonth.year !== currentYear || currentSelectedMonth.month !== currentMonth) {
                console.log("📅 Refreshing selected month (different from current):", currentSelectedMonth);
                await fetchMonthCount(currentSelectedMonth.year, currentSelectedMonth.month, false);
                console.log("✅ Selected month count refreshed");
              }
            } catch (error) {
              console.error("❌ Error refreshing counts after new lead:", error);
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE", // Also listen to UPDATE events
            schema: "public",
            table: "leads",
          },
          async (payload) => {
            console.log("🔄 Lead updated, refreshing counts...");
            
            // Refetch counts when any update occurs
            // This updates totalCount via calculateTotalFromAllMonths()
            await fetchCounts(false);
            console.log("✅ fetchCounts completed");
            
            // Always refresh the currently selected month when leads are updated
            // This ensures the monthly count updates in real-time
            const currentSelectedMonth = selectedMonthRef.current;
            console.log("📅 Refreshing selected month:", currentSelectedMonth);
            await fetchMonthCount(currentSelectedMonth.year, currentSelectedMonth.month, false);
            console.log("✅ fetchMonthCount completed");
          }
        )
        .subscribe((status) => {
          console.log("📡 Realtime subscription status:", status);
        });

      // Cleanup subscription on unmount
      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setLoading(false);
    }
  }, []);

  // Separate function to fetch graph data to avoid race conditions with state updates
  const fetchGraphData = async (range: "7d" | "30d" | "90d" | "custom") => {
    // Increment request ID to track the latest request
    graphRequestIdRef.current += 1;
    const currentRequestId = graphRequestIdRef.current;
    
    try {
      const supabase = getSupabaseClient();
      
      // Always use current date at the time of fetch to ensure consistency
      const fetchTime = new Date();
      fetchTime.setHours(0, 0, 0, 0);
      const endDate = new Date(fetchTime);
      endDate.setDate(endDate.getDate() + 1); // Tomorrow
      endDate.setHours(0, 0, 0, 0);
      
      let startDate: Date;
      let daysToProcess: number;
      
      if (range === "7d") {
        startDate = new Date(fetchTime);
        startDate.setDate(startDate.getDate() - 7);
        daysToProcess = 7;
      } else if (range === "30d") {
        startDate = new Date(fetchTime);
        startDate.setDate(startDate.getDate() - 30);
        daysToProcess = 30;
      } else {
        // 90d - aggregate by week
        startDate = new Date(fetchTime);
        startDate.setDate(startDate.getDate() - 90);
        daysToProcess = 13; // 13 weeks
      }
      
      startDate.setHours(0, 0, 0, 0);
      
      // Fetch all data in one query
      const { data: allLeads, error: graphError } = await supabase
        .from("leads")
        .select("created_at")
        .gte("created_at", startDate.toISOString())
        .lt("created_at", endDate.toISOString())
        .neq("resubmitted", true);
      
      // Check if this is still the latest request (ignore stale requests)
      if (currentRequestId !== graphRequestIdRef.current) {
        console.log(`Ignoring stale graph data request for range: ${range}`);
        return;
      }
      
      if (graphError) {
        console.error("Error fetching graph data:", graphError);
        // Only update state if this is still the latest request
        if (currentRequestId === graphRequestIdRef.current) {
          setDailyData([]);
        }
        return;
      }
      
      if (!allLeads) {
        // Only update state if this is still the latest request
        if (currentRequestId === graphRequestIdRef.current) {
          setDailyData([]);
        }
        return;
      }
      
      if (range === "90d") {
        // Group by week (13 weeks)
        const weekMap = new Map<string, number>();
        
        // Initialize all weeks
        for (let week = 0; week < 13; week++) {
          const weekStart = new Date(startDate);
          weekStart.setDate(weekStart.getDate() + (week * 7));
          weekStart.setHours(0, 0, 0, 0);
          weekMap.set(weekStart.toISOString().split("T")[0], 0);
        }
        
        // Group leads by week
        allLeads.forEach((lead) => {
          const leadDate = new Date(lead.created_at);
          const daysDiff = Math.floor((leadDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          const weekIndex = Math.min(Math.max(0, Math.floor(daysDiff / 7)), 12);
          const weekStart = new Date(startDate);
          weekStart.setDate(weekStart.getDate() + (weekIndex * 7));
          weekStart.setHours(0, 0, 0, 0);
          const weekKey = weekStart.toISOString().split("T")[0];
          weekMap.set(weekKey, (weekMap.get(weekKey) || 0) + 1);
        });
        
        const results = Array.from(weekMap.entries())
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date));
        
        // Double-check this is still the latest request before updating state
        if (currentRequestId === graphRequestIdRef.current) {
          setDailyData(results);
        }
      } else {
        // Group by day for 7d and 30d
        const dateMap = new Map<string, number>();
        
        // Initialize all days
        for (let i = 0; i < daysToProcess; i++) {
          const date = new Date(startDate);
          date.setDate(date.getDate() + i);
          date.setHours(0, 0, 0, 0);
          dateMap.set(date.toISOString().split("T")[0], 0);
        }
        
        // Group leads by date
        allLeads.forEach((lead) => {
          const leadDate = new Date(lead.created_at);
          leadDate.setHours(0, 0, 0, 0);
          const dateKey = leadDate.toISOString().split("T")[0];
          if (dateMap.has(dateKey)) {
            dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1);
          }
        });
        
        const results = Array.from(dateMap.entries())
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date));
        
        // Double-check this is still the latest request before updating state
        if (currentRequestId === graphRequestIdRef.current) {
          setDailyData(results);
        }
      }
    } catch (error) {
      // Only update state if this is still the latest request
      if (currentRequestId === graphRequestIdRef.current) {
        console.error("Error in fetchGraphData:", error);
        setDailyData([]);
      }
    }
  };

  // Check if two names are similar (case-insensitive match)
  const areNamesSimilar = (name1: string, name2: string): boolean => {
    if (!name1 || !name2) return false;
    return name1.trim().toLowerCase() === name2.trim().toLowerCase();
  };

  // Check if all details match (excluding timestamps)
  const allDetailsMatch = (lead1: Lead, lead2: Lead): boolean => {
    return (
      lead1.customer_name === lead2.customer_name &&
      lead1.airtel_number === lead2.airtel_number &&
      lead1.alternate_number === lead2.alternate_number &&
      lead1.email === lead2.email &&
      lead1.preferred_package === lead2.preferred_package &&
      lead1.installation_town === lead2.installation_town &&
      lead1.delivery_landmark === lead2.delivery_landmark &&
      lead1.agent_type === lead2.agent_type &&
      lead1.enterprise_cp === lead2.enterprise_cp &&
      lead1.agent_name === lead2.agent_name &&
      lead1.agent_mobile === lead2.agent_mobile &&
      lead1.lead_type === lead2.lead_type &&
      lead1.connection_type === lead2.connection_type
    );
  };

  // Helper function to check if a customer is "Unknown Customer"
  const isUnknownCustomer = (lead: Lead): boolean => {
    const name = (lead.customer_name || "").trim().toLowerCase();
    return name === "unknown customer" || name === "";
  };

  // Helper function to check if two leads are duplicates (using same logic as checkDuplicateStatus)
  // Note: This uses only the fields we fetch for counting (name, phones, email)
  const areLeadsDuplicates = (lead1: Lead, lead2: Lead): boolean => {
    // Skip if either has bypass_duplicate_check flag
    if (lead1.bypass_duplicate_check === true || lead2.bypass_duplicate_check === true) {
      return false;
    }

    // Check 1: Both phone numbers + email match → RED duplicate
    if (
      lead1.airtel_number &&
      lead2.airtel_number &&
      lead1.alternate_number &&
      lead2.alternate_number &&
      lead1.airtel_number === lead2.airtel_number &&
      lead1.alternate_number === lead2.alternate_number &&
      lead1.email &&
      lead1.email === lead2.email
    ) {
      return true;
    }

    // Check 2: Same customer_name + same airtel_number → RED duplicate
    if (
      lead1.customer_name &&
      lead2.customer_name &&
      lead1.airtel_number &&
      lead2.airtel_number &&
      lead1.customer_name === lead2.customer_name &&
      lead1.airtel_number === lead2.airtel_number
    ) {
      return true;
    }

    // Check 3: Similar customer names (case-insensitive) with at least one phone number matches → RED duplicate
    if (
      areNamesSimilar(lead1.customer_name, lead2.customer_name) &&
      ((lead1.airtel_number && lead2.airtel_number && lead1.airtel_number === lead2.airtel_number) ||
        (lead1.alternate_number && lead2.alternate_number && lead1.alternate_number === lead2.alternate_number))
    ) {
      return true;
    }

    // Check 4: Both phone numbers match (even if names differ) → RED duplicate
    if (
      lead1.airtel_number &&
      lead2.airtel_number &&
      lead1.alternate_number &&
      lead2.alternate_number &&
      lead1.airtel_number === lead2.airtel_number &&
      lead1.alternate_number === lead2.alternate_number
    ) {
      return true;
    }

    // Check 5: Same airtel_number OR same alternate_number (if both have the same number) → RED duplicate
    // This catches cases where one lead has airtel_number and the other has it as alternate_number
    if (
      lead1.airtel_number &&
      lead2.airtel_number &&
      lead1.airtel_number === lead2.airtel_number
    ) {
      return true;
    }
    if (
      lead1.alternate_number &&
      lead2.alternate_number &&
      lead1.alternate_number === lead2.alternate_number
    ) {
      return true;
    }
    // Cross-match: airtel_number matches alternate_number
    if (
      lead1.airtel_number &&
      lead2.alternate_number &&
      lead1.airtel_number === lead2.alternate_number
    ) {
      return true;
    }
    if (
      lead1.alternate_number &&
      lead2.airtel_number &&
      lead1.alternate_number === lead2.airtel_number
    ) {
      return true;
    }

    return false;
  };

  // Helper function to count unique customers from leads
  const countUniqueCustomers = (leads: Lead[]): number => {
    // Filter out resubmitted and unknown customers
    const validLeads = leads.filter(
      (lead) => lead.resubmitted !== true && !isUnknownCustomer(lead)
    );

    // Separate bypassed leads (count each as unique)
    const bypassedLeads = validLeads.filter(
      (lead) => lead.bypass_duplicate_check === true
    );
    const regularLeads = validLeads.filter(
      (lead) => lead.bypass_duplicate_check !== true
    );

    // Count unique regular leads (excluding duplicates)
    const uniqueLeads: Lead[] = [];
    
    for (const lead of regularLeads) {
      // Check if this lead is a duplicate of any already counted lead
      const isDuplicate = uniqueLeads.some((existingLead) =>
        areLeadsDuplicates(lead, existingLead)
      );

      // Only add if it's not a duplicate
      if (!isDuplicate) {
        uniqueLeads.push(lead);
      }
    }

    // Total unique count = unique regular leads + all bypassed leads
    return uniqueLeads.length + bypassedLeads.length;
  };

  const fetchCounts = async (showLoading = true) => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    try {
      if (showLoading) {
        setLoading(true);
      }
      const supabase = getSupabaseClient();

      // Prepare date ranges
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      const todayStart = todayDate.toISOString();
      const tomorrow = new Date(todayDate);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStart = tomorrow.toISOString();
      const yesterdayDate = new Date(todayDate);
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterdayStart = yesterdayDate.toISOString();

      // Fetch all leads data for unique counting (excluding resubmitted)
      // Calculate total registered by summing all months' registrations
      console.log("🔄 Starting calculateTotalFromAllMonths...");
      const totalFromAllMonths = await calculateTotalFromAllMonths();
      console.log("📊 Total from all months calculated:", totalFromAllMonths);
      if (totalFromAllMonths !== null && totalFromAllMonths !== undefined) {
        setTotalCount(totalFromAllMonths);
        console.log("✅ totalCount state updated to:", totalFromAllMonths);
      } else {
        console.error("❌ calculateTotalFromAllMonths returned null/undefined");
      }

      // We need the actual data to calculate unique customers for today and yesterday
      const [todayLeadsResult, yesterdayLeadsResult, leadsResult] = await Promise.all([
        // Today's leads (including resubmitted)
        supabase
          .from("leads")
          .select(
            "id, customer_name, airtel_number, alternate_number, email, bypass_duplicate_check, resubmitted, created_at"
          )
          .gte("created_at", todayStart)
          .lt("created_at", tomorrowStart),
        
        // Yesterday's leads
        supabase
          .from("leads")
          .select(
            "id, customer_name, airtel_number, alternate_number, email, bypass_duplicate_check, resubmitted, created_at"
          )
          .gte("created_at", yesterdayStart)
          .lt("created_at", todayStart)
          .neq("resubmitted", true),
        
        // Fetch leads data (limit to recent 200 for performance)
        supabase
          .from("leads")
          .select(
            "id, customer_name, airtel_number, alternate_number, email, preferred_package, installation_town, delivery_landmark, visit_date, visit_time, agent_type, enterprise_cp, agent_name, agent_mobile, lead_type, connection_type, created_at, bypass_duplicate_check, resubmitted"
          )
          .order("created_at", { ascending: false })
          .limit(200), // Limit to 200 most recent leads for faster loading
      ]);

      if (todayLeadsResult.error) {
        handleSupabaseError(todayLeadsResult.error);
        console.error("Error fetching today's leads:", todayLeadsResult.error);
        setTodayCount(0);
      } else {
        // For today's count, include resubmitted and count unique
        const todayLeads = (todayLeadsResult.data || []).filter(
          (lead) => {
            const name = (lead.customer_name || "").trim().toLowerCase();
            return name !== "unknown customer" && name !== "";
          }
        );

        const bypassedLeads = todayLeads.filter(
          (lead) => lead.bypass_duplicate_check === true
        );
        const regularLeads = todayLeads.filter(
          (lead) => lead.bypass_duplicate_check !== true
        );

        const uniqueLeads: Lead[] = [];
        
        for (const lead of regularLeads) {
          const isDuplicate = uniqueLeads.some((existingLead) =>
            areLeadsDuplicates(lead, existingLead)
          );
          if (!isDuplicate) {
            uniqueLeads.push(lead);
          }
        }

        const uniqueTodayCount = uniqueLeads.length + bypassedLeads.length;
        setTodayCount(uniqueTodayCount);
      }

      if (yesterdayLeadsResult.error) {
        handleSupabaseError(yesterdayLeadsResult.error);
        console.error("Error fetching yesterday's leads:", yesterdayLeadsResult.error);
        setYesterdayCount(0);
      } else {
        const uniqueYesterdayCount = countUniqueCustomers(yesterdayLeadsResult.data || []);
        setYesterdayCount(uniqueYesterdayCount);
      }

      // Handle leads data
      if (leadsResult.error) {
        handleSupabaseError(leadsResult.error);
        console.error("Error fetching leads:", leadsResult.error);
        setLeads([]);
      } else {
        setLeads(leadsResult.data || []);
      }

      // Fetch monthly progress data - use ref to get latest selected month
      const currentSelectedMonth = selectedMonthRef.current;
      await fetchMonthCount(currentSelectedMonth.year, currentSelectedMonth.month, false);
      console.log("✅ fetchMonthCount completed in fetchCounts");
    } catch (error) {
      console.error("Unexpected error in fetchCounts:", {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      setTotalCount(0);
      setTodayCount(0);
      setLeads([]);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  // Calculate total registered by summing all months' registrations
  // Uses the exact same logic as fetchMonthCount for each month
  const calculateTotalFromAllMonths = async () => {
    if (!isSupabaseConfigured) {
      return 0;
    }

    try {
      const supabase = getSupabaseClient();

      // Get the earliest registration date
      const { data: earliestLead, error: earliestError } = await supabase
        .from("leads")
        .select("created_at")
        .neq("resubmitted", true)
        .order("created_at", { ascending: true })
        .limit(1);

      if (earliestError || !earliestLead || earliestLead.length === 0) {
        return 0;
      }

      // Parse the earliest date
      const earliestDate = new Date(earliestLead[0].created_at);
      const now = new Date();
      
      // Start from the first month with registrations
      let currentYear = earliestDate.getFullYear();
      let currentMonth = earliestDate.getMonth();
      
      // End at the current month
      const endYear = now.getFullYear();
      const endMonth = now.getMonth();

      let totalSum = 0;
      let monthCount = 0;

      console.log(`🔄 Calculating total from ${currentYear}-${currentMonth} to ${endYear}-${endMonth}`);

      // Iterate through each month from earliest to current
      // Use the EXACT same date range logic as fetchMonthCount
      while (
        currentYear < endYear || 
        (currentYear === endYear && currentMonth <= endMonth)
      ) {
        monthCount++;
        // Use the exact same date calculation as fetchMonthCount
        const firstDay = new Date(currentYear, currentMonth, 1);
        const lastDay = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

        const monthStart = firstDay.toISOString();
        const monthEnd = lastDay.toISOString();

        // Use the exact same query as fetchMonthCount
        const { data: monthLeads, error: monthError } = await supabase
          .from("leads")
          .select("id, customer_name, airtel_number, alternate_number, email, bypass_duplicate_check, resubmitted, created_at")
          .gte("created_at", monthStart)
          .lte("created_at", monthEnd)
          .neq("resubmitted", true);

        if (monthError) {
          console.error(`❌ Error fetching leads for ${currentYear}-${currentMonth}:`, monthError);
          // Continue to next month even if this one fails
        } else if (monthLeads && monthLeads.length > 0) {
          // Use the exact same counting logic as fetchMonthCount
          const uniqueCount = countUniqueCustomers(monthLeads);
          totalSum += uniqueCount;
          console.log(`  ✓ ${currentYear}-${currentMonth}: ${uniqueCount} unique (${monthLeads.length} total leads)`);
        }

        // Move to next month
        currentMonth++;
        if (currentMonth > 11) {
          currentMonth = 0;
          currentYear++;
        }
      }

      console.log(`✅ Calculated total from ${monthCount} months: ${totalSum}`);
      return totalSum;
    } catch (error) {
      console.error("Unexpected error in calculateTotalFromAllMonths:", error);
      return 0;
    }
  };

  // Fetch selected month count
  const fetchMonthCount = async (year: number, month: number, showLoading = true) => {
    if (!isSupabaseConfigured) {
      setMonthLoading(false);
      return;
    }

    try {
      if (showLoading) {
        setMonthLoading(true);
      }

      const supabase = getSupabaseClient();

      // Get first and last day of selected month
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0, 23, 59, 59, 999);

      const monthStart = firstDay.toISOString();
      const monthEnd = lastDay.toISOString();

      console.log(`🔍 fetchMonthCount for ${year}-${month}:`, {
        monthStart,
        monthEnd,
        firstDay: firstDay.toISOString(),
        lastDay: lastDay.toISOString()
      });

      // Fetch all leads for selected month (excluding resubmitted)
      // Note: Supabase has a default limit of 1000, so we need to fetch in batches if there are more
      let allLeads: Lead[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: leads, error: batchError } = await supabase
          .from("leads")
          .select("id, customer_name, airtel_number, alternate_number, email, bypass_duplicate_check, resubmitted, created_at")
          .gte("created_at", monthStart)
          .lte("created_at", monthEnd)
          .neq("resubmitted", true)
          .range(from, from + batchSize - 1)
          .order("created_at", { ascending: true });

        if (batchError) {
          console.error(`Error fetching leads batch (${from} to ${from + batchSize - 1}):`, batchError);
          break;
        }

        if (leads && leads.length > 0) {
          allLeads = [...allLeads, ...leads];
          from += batchSize;
          hasMore = leads.length === batchSize; // If we got a full batch, there might be more
        } else {
          hasMore = false;
        }
      }

      const leads = allLeads;
      const error = null; // No error if we got here

      if (error) {
        console.log(`📥 Fetched ${leads?.length || 0} leads for ${year}-${month}`, {
          hasError: true,
          error: String(error)
        });
      } else {
        console.log(`📥 Fetched ${leads?.length || 0} leads for ${year}-${month}`, {
          hasError: false
        });
      }

      if (error) {
        handleSupabaseError(error);
        console.error("Error fetching month leads:", error);
        setCurrentMonthCount(0);
      } else {
        // Use the comprehensive duplicate detection logic
        const rawLeads = leads || [];
        console.log(`📊 Processing ${rawLeads.length} raw leads for ${year}-${month}`);
        
        // Check if this is the current month
        const now = new Date();
        const isCurrentMonthCheck = year === now.getFullYear() && month === now.getMonth();
        console.log(`📅 Is current month? ${isCurrentMonthCheck} (now: ${now.getFullYear()}-${now.getMonth()}, selected: ${year}-${month})`);
        
        // Show sample of lead dates to verify date range
        if (rawLeads.length > 0) {
          const sampleDates = rawLeads.slice(0, 3).map(l => new Date(l.created_at).toISOString());
          console.log(`📆 Sample lead dates:`, sampleDates);
        }
        
        const uniqueCount = countUniqueCustomers(rawLeads);
        console.log(`📈 Month count for ${year}-${month}:`, uniqueCount, "unique from", rawLeads.length, "total leads");
        console.log(`💾 Setting currentMonthCount state to:`, uniqueCount);
        
        // Check if we just hit or exceeded the target
        const previousCount = currentMonthCount;
        
        setCurrentMonthCount(uniqueCount);
        
        // Show celebration if target is achieved for the current month
        // It will stay visible until the month ends
        if (isCurrentMonthCheck && uniqueCount >= TARGET_MONTHLY) {
          if (!showCelebration) {
            console.log("🎉 Target reached! Showing celebration...");
            setShowCelebration(true);
            // Animate celebration appearance
            Animated.timing(celebrationOpacity, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }).start();
          }
        } else {
          // Hide celebration if we're not in current month or target not reached
          if (showCelebration) {
            setShowCelebration(false);
            celebrationOpacity.setValue(0);
          }
        }
        
        console.log("✅ currentMonthCount state updated to:", uniqueCount);
      }
    } catch (error) {
      console.error("Unexpected error in fetchMonthCount:", error);
      setCurrentMonthCount(0);
    } finally {
      if (showLoading) {
        setMonthLoading(false);
      }
    }
  };

  // Animate progress when count changes
  useEffect(() => {
    if (currentMonthCount !== null) {
      const newProgress = Math.min(currentMonthCount / TARGET_MONTHLY, 1);
      Animated.timing(progressAnimation, {
        toValue: newProgress,
        duration: 1000,
        useNativeDriver: false,
      }).start((finished) => {
        if (finished) {
          // Ensure value is set even if animation completes immediately
          progressAnimation.setValue(newProgress);
        }
      });
    } else {
      // Reset to 0 when count is null
      progressAnimation.setValue(0);
    }
  }, [currentMonthCount, progressAnimation]);

  // Fetch data when selected month changes
  useEffect(() => {
    fetchMonthCount(selectedMonth.year, selectedMonth.month);
    
    // Update celebration visibility based on selected month
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const isCurrentMonth = selectedMonth.year === currentYear && selectedMonth.month === currentMonth;
    
    // Only show celebration if viewing current month and target is achieved
    if (isCurrentMonth && currentMonthCount !== null && currentMonthCount >= TARGET_MONTHLY) {
      setShowCelebration(true);
      celebrationOpacity.setValue(1);
    } else {
      setShowCelebration(false);
      celebrationOpacity.setValue(0);
    }
  }, [selectedMonth, currentMonthCount]);

  // Get month name
  const getMonthName = (year: number, month: number) => {
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    return `${months[month]} ${year}`;
  };

  // Navigate to previous month
  const goToPreviousMonth = () => {
    setSelectedMonth((prev) => {
      if (prev.month === 0) {
        return { year: prev.year - 1, month: 11 };
      }
      return { year: prev.year, month: prev.month - 1 };
    });
  };

  // Navigate to next month
  const goToNextMonth = () => {
    const now = new Date();
    const maxDate = { year: now.getFullYear(), month: now.getMonth() };
    
    setSelectedMonth((prev) => {
      // Don't allow going to future months
      if (prev.year > maxDate.year || (prev.year === maxDate.year && prev.month >= maxDate.month)) {
        return prev;
      }
      
      if (prev.month === 11) {
        return { year: prev.year + 1, month: 0 };
      }
      return { year: prev.year, month: prev.month + 1 };
    });
  };

  // Check if selected month is current month
  const isCurrentMonth = () => {
    const now = new Date();
    return selectedMonth.year === now.getFullYear() && selectedMonth.month === now.getMonth();
  };

  // Calculate progress percentage
  const progress = currentMonthCount !== null 
    ? Math.min(currentMonthCount / TARGET_MONTHLY, 1) 
    : 0;
  
  const progressPercentage = Math.round(progress * 100);

  // Circular progress component
  const CircularProgress = ({ size = 280, strokeWidth = 20 }: { size?: number; strokeWidth?: number }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const [animatedValue, setAnimatedValue] = useState(progress);

    useEffect(() => {
      // Set initial value from current progress
      setAnimatedValue(progress);
      
      // Listen for animation updates
      let listener: string | null = null;
      try {
        listener = progressAnimation.addListener(({ value }) => {
          if (typeof value === 'number' && !isNaN(value)) {
            setAnimatedValue(value);
          }
        });
      } catch (error) {
        // If listener fails, use progress directly
        setAnimatedValue(progress);
      }
      
      // Also set a timeout to ensure value updates even if listener doesn't fire
      const timeout = setTimeout(() => {
        setAnimatedValue(progress);
      }, 100);
      
      return () => {
        clearTimeout(timeout);
        if (listener) {
          try {
            progressAnimation.removeListener(listener);
          } catch (error) {
            // Ignore cleanup errors
          }
        }
      };
    }, [progress]);

    // Use the higher value to ensure progress is always visible when there's data
    // But don't show if progress is 0 and we're still loading
    const displayValue = currentMonthCount !== null 
      ? Math.max(animatedValue, progress) 
      : 0;
    const strokeDashoffset = circumference * (1 - displayValue);

    // Check if target is achieved - also show when celebration is manually triggered (for testing)
    const targetAchieved = (currentMonthCount !== null && currentMonthCount >= TARGET_MONTHLY && isCurrentMonth()) || showCelebration;
    const progressColor = targetAchieved ? "#10B981" : "#FFD700"; // Green when achieved, gold otherwise
    
    return (
      <View style={styles.progressContainer}>
        {/* Flower decorations when target is achieved or celebration is shown */}
        {showCelebration && (
          <View style={styles.flowerDecorations}>
            <Text style={[styles.flower, styles.flowerTopLeft]}>🌸</Text>
            <Text style={[styles.flower, styles.flowerTopRight]}>🌺</Text>
            <Text style={[styles.flower, styles.flowerBottomLeft]}>🌻</Text>
            <Text style={[styles.flower, styles.flowerBottomRight]}>🌷</Text>
            <Text style={[styles.flower, styles.flowerTop]}>🌼</Text>
            <Text style={[styles.flower, styles.flowerBottom]}>🌹</Text>
            <Text style={[styles.flower, styles.flowerLeft]}>🌿</Text>
            <Text style={[styles.flower, styles.flowerRight]}>🌿</Text>
          </View>
        )}
        <Svg width={size} height={size} style={styles.progressSvg}>
          {/* Background circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#2A2A2A"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress circle - green when target achieved */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={progressColor}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={styles.progressContent}>
          {monthLoading ? (
            <ActivityIndicator size="large" color="#FFD700" />
          ) : (
            <>
              <Text style={styles.progressNumber}>
                {currentMonthCount !== null ? currentMonthCount : 0}
              </Text>
              <Text style={styles.progressTarget}>/ {TARGET_MONTHLY}</Text>
              <Text style={styles.progressLabel}>
                {isCurrentMonth() ? "This Month" : getMonthName(selectedMonth.year, selectedMonth.month).split(" ")[0]}
              </Text>
              <Text style={styles.progressPercentage}>{progressPercentage}%</Text>
            </>
          )}
        </View>
      </View>
    );
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

  // Format date with ordinal as "4th thursday 2025"
  const formatDateWithOrdinal = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const dayNames = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const dayName = dayNames[date.getDay()];
    const year = date.getFullYear();

    // Get ordinal suffix
    const getOrdinal = (n: number) => {
      const s = ["th", "st", "nd", "rd"];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };

    return `${getOrdinal(day)} ${dayName} ${year}`;
  };

  // Check if date is today
  const isToday = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Group leads by date
  const groupLeadsByDate = (leads: Lead[]) => {
    const grouped: { [key: string]: Lead[] } = {};

    leads.forEach((lead) => {
      const date = new Date(lead.created_at);
      // Create a date key using YYYY-MM-DD format
      const year = date.getFullYear();
      const month = date.getMonth();
      const day = date.getDate();
      const dateKey = `${year}-${month}-${day}`;

      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(lead);
    });

    // Convert to array and sort by date (newest first)
    return Object.entries(grouped)
      .sort(([dateKeyA], [dateKeyB]) => {
        // Parse the date keys and compare
        const [yearA, monthA, dayA] = dateKeyA.split("-").map(Number);
        const [yearB, monthB, dayB] = dateKeyB.split("-").map(Number);
        const dateA = new Date(yearA, monthA, dayA).getTime();
        const dateB = new Date(yearB, monthB, dayB).getTime();
        return dateB - dateA;
      })
      .map(([dateKey, leads]) => ({
        dateKey,
        date: leads[0].created_at,
        leads,
      }));
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

  // Check duplicate status for a lead
  const checkDuplicateStatus = (
    currentLead: Lead,
    allLeads: Lead[]
  ): "red" | "orange" | null => {
    // Skip duplicate checking if this lead has bypass_duplicate_check flag
    if (currentLead.bypass_duplicate_check === true) {
      return null;
    }

    for (const otherLead of allLeads) {
      // Skip comparing with itself
      if (currentLead.id === otherLead.id) continue;

      // Skip comparing with leads that have bypass_duplicate_check flag
      if (otherLead.bypass_duplicate_check === true) continue;

      // Check 1: All details match (excluding timestamps) → RED
      if (allDetailsMatch(currentLead, otherLead)) {
        return "red";
      }

      // Check 2: Both phone numbers + email match → RED
      if (
        currentLead.airtel_number === otherLead.airtel_number &&
        currentLead.alternate_number === otherLead.alternate_number &&
        currentLead.email &&
        currentLead.email === otherLead.email
      ) {
        return "red";
      }

      // Check 3: Different name but both phone numbers match → ORANGE
      if (
        currentLead.customer_name !== otherLead.customer_name &&
        currentLead.airtel_number === otherLead.airtel_number &&
        currentLead.alternate_number === otherLead.alternate_number
      ) {
        return "orange";
      }

      // Check 4: Only email matches → ORANGE
      if (
        currentLead.email &&
        currentLead.email === otherLead.email &&
        (currentLead.airtel_number !== otherLead.airtel_number ||
          currentLead.alternate_number !== otherLead.alternate_number ||
          currentLead.customer_name !== otherLead.customer_name)
      ) {
        return "orange";
      }

      // Check 5: Same customer_name + same airtel_number → RED
      if (
        currentLead.customer_name === otherLead.customer_name &&
        currentLead.airtel_number === otherLead.airtel_number
      ) {
        return "red";
      }

      // Check 6: Similar customer names (case-insensitive) with at least one phone number matches → RED
      if (
        areNamesSimilar(currentLead.customer_name, otherLead.customer_name) &&
        (currentLead.airtel_number === otherLead.airtel_number ||
          currentLead.alternate_number === otherLead.alternate_number)
      ) {
        return "red";
      }

      // Check 7: Same airtel_number OR same alternate_number (just one number matches) → ORANGE
      if (
        (currentLead.airtel_number === otherLead.airtel_number &&
          currentLead.alternate_number !== otherLead.alternate_number) ||
        (currentLead.alternate_number === otherLead.alternate_number &&
          currentLead.airtel_number !== otherLead.airtel_number)
      ) {
        return "orange";
      }
    }

    return null;
  };

  // Optimized duplicate check using pre-built indexes
  const checkDuplicateStatusOptimized = (
    currentLead: Lead,
    allLeads: Lead[],
    phoneMap: Map<string, Lead[]>,
    emailMap: Map<string, Lead[]>,
    nameMap: Map<string, Lead[]>
  ): "red" | "orange" | null => {
    // Skip duplicate checking if this lead has bypass_duplicate_check flag
    if (currentLead.bypass_duplicate_check === true) {
      return null;
    }

    // Get potential matches from indexes (much faster than iterating all leads)
    const potentialMatches = new Set<Lead>();
    
    // Add leads with matching phone numbers
    if (currentLead.airtel_number) {
      const key = currentLead.airtel_number.trim().toLowerCase();
      phoneMap.get(key)?.forEach(lead => {
        if (lead.id !== currentLead.id) potentialMatches.add(lead);
      });
    }
    if (currentLead.alternate_number) {
      const key = currentLead.alternate_number.trim().toLowerCase();
      phoneMap.get(key)?.forEach(lead => {
        if (lead.id !== currentLead.id) potentialMatches.add(lead);
      });
    }
    
    // Add leads with matching email
    if (currentLead.email) {
      const key = currentLead.email.trim().toLowerCase();
      emailMap.get(key)?.forEach(lead => {
        if (lead.id !== currentLead.id) potentialMatches.add(lead);
      });
    }
    
    // Add leads with matching or similar names
    if (currentLead.customer_name) {
      const key = currentLead.customer_name.trim().toLowerCase();
      nameMap.get(key)?.forEach(lead => {
        if (lead.id !== currentLead.id) potentialMatches.add(lead);
      });
    }

    // Now check only potential matches (much smaller set)
    for (const otherLead of potentialMatches) {
      // Skip comparing with leads that have bypass_duplicate_check flag
      if (otherLead.bypass_duplicate_check === true) continue;

      // Check 1: All details match (excluding timestamps) → RED
      if (allDetailsMatch(currentLead, otherLead)) {
        return "red";
      }

      // Check 2: Both phone numbers + email match → RED
      if (
        currentLead.airtel_number === otherLead.airtel_number &&
        currentLead.alternate_number === otherLead.alternate_number &&
        currentLead.email &&
        currentLead.email === otherLead.email
      ) {
        return "red";
      }

      // Check 3: Different name but both phone numbers match → ORANGE
      if (
        currentLead.customer_name !== otherLead.customer_name &&
        currentLead.airtel_number === otherLead.airtel_number &&
        currentLead.alternate_number === otherLead.alternate_number
      ) {
        return "orange";
      }

      // Check 4: Only email matches → ORANGE
      if (
        currentLead.email &&
        currentLead.email === otherLead.email &&
        (currentLead.airtel_number !== otherLead.airtel_number ||
          currentLead.alternate_number !== otherLead.alternate_number ||
          currentLead.customer_name !== otherLead.customer_name)
      ) {
        return "orange";
      }

      // Check 5: Same customer_name + same airtel_number → RED
      if (
        currentLead.customer_name === otherLead.customer_name &&
        currentLead.airtel_number === otherLead.airtel_number
      ) {
        return "red";
      }

      // Check 6: Similar customer names (case-insensitive) with at least one phone number matches → RED
      if (
        areNamesSimilar(currentLead.customer_name, otherLead.customer_name) &&
        (currentLead.airtel_number === otherLead.airtel_number ||
          currentLead.alternate_number === otherLead.alternate_number)
      ) {
        return "red";
      }

      // Check 7: Same airtel_number OR same alternate_number (just one number matches) → ORANGE
      if (
        (currentLead.airtel_number === otherLead.airtel_number &&
          currentLead.alternate_number !== otherLead.alternate_number) ||
        (currentLead.alternate_number === otherLead.alternate_number &&
          currentLead.airtel_number !== otherLead.airtel_number)
      ) {
        return "orange";
      }
    }

    return null;
  };

  // Group leads that are duplicates of each other
  const groupDuplicates = (allLeads: Lead[]): Map<string, string[]> => {
    const groups = new Map<string, string[]>();
    const processed = new Set<string>();

    allLeads.forEach((lead) => {
      if (processed.has(lead.id)) return;

      const group: string[] = [lead.id];
      processed.add(lead.id);

      // Find all leads that are duplicates of this one
      allLeads.forEach((otherLead) => {
        if (lead.id === otherLead.id || processed.has(otherLead.id)) return;

        // Use checkDuplicateStatus to check for both red and orange duplicates
        const status = checkDuplicateStatus(lead, [otherLead]);
        if (status === "red" || status === "orange") {
          group.push(otherLead.id);
          processed.add(otherLead.id);
        }
      });

      if (group.length > 1) {
        // Create a unique key for this group (use the first lead's id)
        groups.set(lead.id, group);
      }
    });

    return groups;
  };

  // Calculate duplicate status for all leads (optimized and non-blocking)
  useEffect(() => {
    if (leads.length === 0) {
      setDuplicateCount(0);
      setTodayDuplicateCount(0);
      setDuplicateStatus({});
      return;
    }

    // Initialize all as null first (non-blocking)
    const initialStatus: { [key: string]: "red" | "orange" | null } = {};
    leads.forEach((lead) => {
      initialStatus[lead.id] = null;
    });
    setDuplicateStatus(initialStatus);

    // Defer heavy computation to avoid blocking UI
    const timeoutId = setTimeout(() => {
      // Only check first 200 leads for duplicates (most recent ones)
      // This dramatically improves performance while still catching most duplicates
      const leadsToProcess = leads.slice(0, 200);
      
      // Build lookup maps for faster duplicate detection
      const phoneMap = new Map<string, Lead[]>();
      const emailMap = new Map<string, Lead[]>();
      const nameMap = new Map<string, Lead[]>();
      
      // Filter out bypassed leads for faster processing
      const leadsToCheck = leadsToProcess.filter(lead => lead.bypass_duplicate_check !== true);
      
      // Build indexes only for leads we're checking
      leadsToCheck.forEach((lead) => {
        // Index by phone numbers
        if (lead.airtel_number) {
          const key = lead.airtel_number.trim().toLowerCase();
          if (!phoneMap.has(key)) phoneMap.set(key, []);
          phoneMap.get(key)!.push(lead);
        }
        if (lead.alternate_number) {
          const key = lead.alternate_number.trim().toLowerCase();
          if (!phoneMap.has(key)) phoneMap.set(key, []);
          phoneMap.get(key)!.push(lead);
        }
        
        // Index by email
        if (lead.email) {
          const key = lead.email.trim().toLowerCase();
          if (!emailMap.has(key)) emailMap.set(key, []);
          emailMap.get(key)!.push(lead);
        }
        
        // Index by name
        if (lead.customer_name) {
          const key = lead.customer_name.trim().toLowerCase();
          if (!nameMap.has(key)) nameMap.set(key, []);
          nameMap.get(key)!.push(lead);
        }
      });

      const status: { [key: string]: "red" | "orange" | null } = { ...initialStatus };
      
      // Only check leads that aren't bypassed (limited to first 200)
      leadsToCheck.forEach((lead) => {
        status[lead.id] = checkDuplicateStatusOptimized(lead, leadsToCheck, phoneMap, emailMap, nameMap);
      });
      
      setDuplicateStatus(status);

      // Count unique duplicate groups (only count extras, not all duplicates)
      const duplicateGroups = groupDuplicates(leadsToCheck);
      let totalExtras = 0;
      duplicateGroups.forEach((group) => {
        totalExtras += group.length - 1;
      });
      setDuplicateCount(totalExtras);

      // Calculate today's duplicate count
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let todayExtras = 0;

      duplicateGroups.forEach((group) => {
        const groupLeads = group
          .map((id) => leadsToCheck.find((l) => l.id === id))
          .filter(Boolean) as Lead[];
        const todayLeadsInGroup = groupLeads.filter((lead) => {
          const leadDate = new Date(lead.created_at);
          leadDate.setHours(0, 0, 0, 0);
          return leadDate.getTime() === today.getTime();
        });

        if (todayLeadsInGroup.length > 0) {
          if (todayLeadsInGroup.length > 1) {
            todayExtras += todayLeadsInGroup.length - 1;
          } else if (groupLeads.length > 1) {
            todayExtras += 1;
          }
        }
      });

      setTodayDuplicateCount(todayExtras);
    }, 300); // Increased delay to let UI render first

    return () => clearTimeout(timeoutId);
  }, [leads]);

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

  // Get full phone number with 254 prefix for calling
  const getFullPhoneNumber = (phone: string) => {
    if (!phone) return phone;
    let cleaned = phone.replace(/\s|-/g, "");
    if (!cleaned.startsWith("254")) {
      if (cleaned.startsWith("0")) {
        cleaned = "254" + cleaned.substring(1);
      } else {
        cleaned = "254" + cleaned;
      }
    }
    return cleaned;
  };

  // Copy phone number to clipboard
  const handleCopyNumber = async (phone: string, numberId: string) => {
    const formatted = formatPhoneNumber(phone);
    await Clipboard.setStringAsync(formatted);

    // Show "Copied" text
    setCopiedNumberId(numberId);

    // Hide "Copied" text after 2 seconds
    setTimeout(() => {
      setCopiedNumberId(null);
    }, 2000);
  };

  // Call phone number
  const handleCallNumber = (phone: string) => {
    const fullNumber = getFullPhoneNumber(phone);
    const phoneUrl = `tel:${fullNumber}`;
    Linking.openURL(phoneUrl).catch((err) => {
      console.error("Error calling:", err);
    });
  };

  // Get phone number in 254 format (12 digits) for SMS API
  const getPhoneForSMS = (phone: string): string => {
    if (!phone) return "";
    // Remove any spaces, dashes, or + signs
    let cleaned = phone.replace(/[\s\-\(\)\+]/g, "");

    // If starts with 0, replace with 254 (e.g., 0712345678 -> 254712345678)
    if (cleaned.startsWith("0")) {
      cleaned = "254" + cleaned.substring(1);
    }
    // If doesn't start with 254, add it (assume it's a local number)
    else if (!cleaned.startsWith("254")) {
      cleaned = "254" + cleaned;
    }

    // Ensure it's exactly 12 digits (254 + 9 digits)
    // If longer, truncate; if shorter, it's invalid
    if (cleaned.length > 12) {
      cleaned = cleaned.substring(0, 12);
    } else if (cleaned.length < 12) {
      // Invalid number, return empty string
      return "";
    }

    return cleaned;
  };

  // Export SMS format Excel (exact format from image)
  const exportSMSFormat = async (
    phoneType: "airtel" | "alternate",
    town: string | null = null,
    dateFilterType: "today" | "all" | string = "all"
  ) => {
    if (!isSupabaseConfigured) {
      Alert.alert("Error", "Supabase is not configured");
      return;
    }

    setExporting(true);
    try {
      const supabase = getSupabaseClient();

      // Build query with filters
      let query = supabase
        .from("leads")
        .select("airtel_number, alternate_number")
        .order("created_at", { ascending: false });

      // Apply town filter
      if (town) {
        query = query.eq("installation_town", town);
      }

      // Apply date filter
      if (dateFilterType === "today") {
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        const todayStart = todayDate.toISOString();
        const tomorrow = new Date(todayDate);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStart = tomorrow.toISOString();
        query = query
          .gte("created_at", todayStart)
          .lt("created_at", tomorrowStart);
      } else if (dateFilterType !== "all") {
        // Custom date (YYYY-MM-DD format)
        const selectedDateObj = new Date(dateFilterType);
        selectedDateObj.setHours(0, 0, 0, 0);
        const dateStart = selectedDateObj.toISOString();
        const nextDay = new Date(selectedDateObj);
        nextDay.setDate(nextDay.getDate() + 1);
        const dateEnd = nextDay.toISOString();
        query = query.gte("created_at", dateStart).lt("created_at", dateEnd);
      }

      const { data: customers, error } = await query;

      if (error) {
        console.error("Error fetching customers:", error);
        Alert.alert("Error", "Failed to fetch customers data");
        return;
      }

      if (!customers || customers.length === 0) {
        Alert.alert("No Data", "No customers found to export");
        return;
      }

      // Format data for SMS API (exact format from image)
      const excelData = customers
        .map((customer) => {
          const phone =
            phoneType === "airtel"
              ? customer.airtel_number
              : customer.alternate_number;
          const phoneForSMS = getPhoneForSMS(phone || "");

          // Only include if phone number exists and is valid
          if (!phoneForSMS || phoneForSMS.length !== 12) return null;

          return {
            "Cell Number": phoneForSMS,
            Username: "",
            "Order Id": "",
            Currency: "",
            Amount: "",
          };
        })
        .filter((row) => row !== null); // Remove invalid entries

      if (excelData.length === 0) {
        Alert.alert("No Data", `No valid ${phoneType} numbers found to export`);
        return;
      }

      // Add red dot in Currency column (first data row)
      // In Excel, we'll set the cell value to a special marker, but for now just leave empty
      // The red dot might need to be added manually or via cell styling

      // Create workbook and worksheet
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths to match the image
      const columnWidths = [
        { wch: 15 }, // Cell Number
        { wch: 15 }, // Username
        { wch: 15 }, // Order Id
        { wch: 12 }, // Currency
        { wch: 12 }, // Amount
      ];
      ws["!cols"] = columnWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "SMS Numbers");

      // Generate Excel file buffer
      const excelBuffer = XLSX.write(wb, {
        type: "base64",
        bookType: "xlsx",
      });

      // Create file name with filters
      const timestamp = new Date().toISOString().split("T")[0];
      const townPart = town ? `_${town.replace(/\s+/g, "_")}` : "";
      let datePart = "";
      if (dateFilterType === "today") {
        datePart = "_Today";
      } else if (dateFilterType !== "all") {
        datePart = `_${dateFilterType}`;
      }
      const fileName = `SMS_Numbers_${phoneType}${townPart}${datePart}_${timestamp}.xlsx`;

      // Use cache directory for temporary file
      const file = new File(Paths.cache, fileName);

      // Write file
      file.write(excelBuffer, { encoding: "base64" });
      const fileUri = file.uri;

      // Share the file
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          dialogTitle: "Export SMS Numbers",
        });
      } else {
        Alert.alert(
          "Success",
          `Excel file saved: ${fileName}\n\nFile location: ${fileUri}`
        );
      }
    } catch (error) {
      console.error("Error exporting SMS format:", error);
      Alert.alert(
        "Error",
        `Failed to export Excel file: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setExporting(false);
    }
  };

  // Toggle export menu
  const handleExportToExcel = () => {
    if (!isSupabaseConfigured) {
      Alert.alert("Error", "Supabase is not configured");
      return;
    }
    setShowExportMenu(!showExportMenu);
  };

  // Handle export option selection - open filter modal (memoized)
  const handleExportOption = useCallback(
    (option: "full" | "airtel" | "alternate") => {
      setShowExportMenu(false);
      setPendingExportOption(option);
      // Reset filters to default
      setSelectedTown(null);
      setDateFilter("all");
      setSelectedDate(null);
      setShowTownList(false);
      // Open filter modal
      setShowFilterModal(true);
    },
    []
  );

  // Memoized modal close handler
  const handleCloseModal = useCallback(() => {
    setShowFilterModal(false);
    setPendingExportOption(null);
  }, []);

  // Apply filters and export (memoized to prevent re-creation)
  const handleApplyFiltersAndExport = useCallback(() => {
    setShowFilterModal(false);
    const option = pendingExportOption;
    if (!option) return;

    // Determine date filter value
    let dateFilterValue: "today" | "all" | string = "all";
    if (dateFilter === "today") {
      dateFilterValue = "today";
    } else if (dateFilter === "custom" && selectedDate) {
      dateFilterValue = selectedDate;
    }

    // Export with filters
    if (option === "full") {
      exportFullDetails(selectedTown, dateFilterValue);
    } else {
      exportSMSFormat(option, selectedTown, dateFilterValue);
    }

    setPendingExportOption(null);
  }, [pendingExportOption, dateFilter, selectedDate, selectedTown]);

  // Format date for display
  const formatSelectedDate = (dateString: string | null) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      const day = date.getDate();
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

  // Export full customer details
  const exportFullDetails = async (
    town: string | null = null,
    dateFilterType: "today" | "all" | string = "all"
  ) => {
    setExporting(true);
    try {
      const supabase = getSupabaseClient();

      // Build query with filters
      let query = supabase
        .from("leads")
        .select(
          "id, customer_name, airtel_number, alternate_number, email, preferred_package, installation_town, delivery_landmark, visit_date, visit_time, created_at"
        )
        .order("created_at", { ascending: false });

      // Apply town filter
      if (town) {
        query = query.eq("installation_town", town);
      }

      // Apply date filter
      if (dateFilterType === "today") {
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        const todayStart = todayDate.toISOString();
        const tomorrow = new Date(todayDate);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStart = tomorrow.toISOString();
        query = query
          .gte("created_at", todayStart)
          .lt("created_at", tomorrowStart);
      } else if (dateFilterType !== "all") {
        // Custom date (YYYY-MM-DD format)
        const selectedDateObj = new Date(dateFilterType);
        selectedDateObj.setHours(0, 0, 0, 0);
        const dateStart = selectedDateObj.toISOString();
        const nextDay = new Date(selectedDateObj);
        nextDay.setDate(nextDay.getDate() + 1);
        const dateEnd = nextDay.toISOString();
        query = query.gte("created_at", dateStart).lt("created_at", dateEnd);
      }

      const { data: customers, error } = await query;

      if (error) {
        console.error("Error fetching customers:", error);
        Alert.alert("Error", "Failed to fetch customers data");
        return;
      }

      if (!customers || customers.length === 0) {
        Alert.alert("No Data", "No customers found to export");
        return;
      }

      // Format data for Excel (excluding agent details)
      const excelData = customers.map((customer, index) => {
        // Format phone numbers
        const airtelFormatted = formatPhoneNumber(customer.airtel_number || "");
        const alternateFormatted = formatPhoneNumber(
          customer.alternate_number || ""
        );

        // Format dates
        const visitDate = customer.visit_date
          ? new Date(customer.visit_date).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : "";

        return {
          "#": index + 1,
          "Customer Name": formatName(customer.customer_name || ""),
          "Airtel Number": airtelFormatted,
          "Alternate Number": alternateFormatted,
          Email: customer.email || "",
          Package: customer.preferred_package || "",
          "Installation Town": customer.installation_town || "",
          "Delivery Landmark": customer.delivery_landmark || "",
          "Visit Date": visitDate,
          "Visit Time": customer.visit_time || "",
        };
      });

      // Create workbook and worksheet
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      const columnWidths = [
        { wch: 5 }, // #
        { wch: 25 }, // Customer Name
        { wch: 15 }, // Airtel Number
        { wch: 15 }, // Alternate Number
        { wch: 25 }, // Email
        { wch: 15 }, // Package
        { wch: 20 }, // Installation Town
        { wch: 25 }, // Delivery Landmark
        { wch: 15 }, // Visit Date
        { wch: 12 }, // Visit Time
      ];
      ws["!cols"] = columnWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Customers");

      // Generate Excel file buffer
      const excelBuffer = XLSX.write(wb, {
        type: "base64",
        bookType: "xlsx",
      });

      // Create file name with filters
      const timestamp = new Date().toISOString().split("T")[0];
      const townPart = town ? `_${town.replace(/\s+/g, "_")}` : "";
      let datePart = "";
      if (dateFilterType === "today") {
        datePart = "_Today";
      } else if (dateFilterType !== "all") {
        datePart = `_${dateFilterType}`;
      }
      const fileName = `Airtel_Customers${townPart}${datePart}_${timestamp}.xlsx`;

      // Use cache directory for temporary file
      const file = new File(Paths.cache, fileName);

      // Write file using the File API (write is synchronous, but we need to await the file creation)
      file.write(excelBuffer, { encoding: "base64" });
      const fileUri = file.uri;

      // Share the file
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          dialogTitle: "Export Customers to Excel",
        });
      } else {
        Alert.alert(
          "Success",
          `Excel file saved: ${fileName}\n\nFile location: ${fileUri}`
        );
      }
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      Alert.alert(
        "Error",
        `Failed to export Excel file: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Section */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Airtel Dashboard</Text>
        <View style={styles.headerRight}>
          <Text style={styles.headerDate}>{formatDate()}</Text>
          <View style={styles.exportContainer}>
            <TouchableOpacity
              onPress={handleExportToExcel}
              disabled={exporting}
              style={styles.exportIconButton}
            >
              {exporting ? (
                <ActivityIndicator size="small" color="#FFD700" />
              ) : (
                <Ionicons name="download-outline" size={20} color="#FFD700" />
              )}
            </TouchableOpacity>
            {showExportMenu && (
              <View style={styles.exportMenuOverlay}>
                <View style={styles.exportMenu}>
                  <TouchableOpacity
                    style={styles.exportMenuItem}
                    onPress={() => handleExportOption("full")}
                  >
                    <Text style={styles.exportMenuText}>Full Details</Text>
                  </TouchableOpacity>
                  <View style={styles.exportMenuSeparator} />
                  <TouchableOpacity
                    style={styles.exportMenuItem}
                    onPress={() => handleExportOption("airtel")}
                  >
                    <Text style={styles.exportMenuText}>SMS (Airtel)</Text>
                  </TouchableOpacity>
                  <View style={styles.exportMenuSeparator} />
                  <TouchableOpacity
                    style={styles.exportMenuItem}
                    onPress={() => handleExportOption("alternate")}
                  >
                    <Text style={styles.exportMenuText}>SMS (Alternate)</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Main Content - Scrollable */}
      <ScrollView
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await fetchCounts(false);
              setRefreshing(false);
            }}
            tintColor="#FFD700"
            colors={["#FFD700"]}
          />
        }
      >
      <View style={styles.statsRow}>
        {/* Left: Registered Today */}
        <View style={styles.statItem}>
          <View style={styles.countRow}>
            {loading ? (
              <Text style={styles.countTextToday}>-</Text>
            ) : (
              <Text style={styles.countTextToday}>
                {todayCount !== null
                  ? Math.max(0, todayCount - todayDuplicateCount)
                  : 0}
              </Text>
            )}
            {!loading && todayCount !== null && yesterdayCount !== null && (
              <View style={styles.trendContainer}>
                <Ionicons
                  name={
                    todayCount - todayDuplicateCount > yesterdayCount
                      ? "trending-up"
                      : "trending-down"
                  }
                  size={20}
                  color={
                    todayCount - todayDuplicateCount > yesterdayCount
                      ? "#10B981"
                      : "#EF4444"
                  }
                  style={styles.trendIcon}
                />
                {yesterdayCount > 0 && (
                  <Text
                    style={[
                      styles.percentageText,
                      todayCount - todayDuplicateCount > yesterdayCount
                        ? styles.percentageTextGreen
                        : styles.percentageTextRed,
                    ]}
                  >
                    {Math.abs(
                      Math.round(
                        ((todayCount - todayDuplicateCount - yesterdayCount) /
                          yesterdayCount) *
                          100
                      )
                    )}
                    %
                  </Text>
                )}
              </View>
            )}
          </View>
          <Text style={styles.labelText}>registered today</Text>
        </View>

        {/* Separator */}
        <View style={styles.separator} />

        {/* Right: Total Registered */}
        <View style={styles.statItem}>
          {loading ? (
            <Text style={styles.countText}>-</Text>
          ) : (
            <Text style={styles.countText}>
              {totalCount !== null
                ? Math.max(0, totalCount - duplicateCount)
                : 0}
            </Text>
          )}
          <Text style={styles.labelText}>total registered</Text>
        </View>
      </View>

      {/* Monthly Progress Section */}
      <View style={styles.graphContainer}>
        <Text style={styles.monthlyTitle}>Monthly Target</Text>
        
        {/* Month Selector */}
        <View style={styles.monthSelector}>
          <TouchableOpacity
            onPress={goToPreviousMonth}
            style={styles.monthNavButton}
          >
            <Ionicons name="chevron-back" size={24} color="#FFD700" />
          </TouchableOpacity>
          
          <Text style={styles.monthName}>
            {getMonthName(selectedMonth.year, selectedMonth.month)}
          </Text>
          
          <TouchableOpacity
            onPress={goToNextMonth}
            style={[
              styles.monthNavButton,
              isCurrentMonth() && styles.monthNavButtonDisabled,
            ]}
            disabled={isCurrentMonth()}
          >
            <Ionicons
              name="chevron-forward"
              size={24}
              color={isCurrentMonth() ? "#6B7280" : "#FFD700"}
            />
          </TouchableOpacity>
        </View>

        {/* Circular Progress */}
        <CircularProgress size={220} strokeWidth={16} />
        
        <View style={styles.monthlyInfoContainer}>
          <Text style={styles.monthlyInfoText}>
            Target: {TARGET_MONTHLY.toLocaleString()} registrations per month
          </Text>
          {currentMonthCount !== null && (
            <Text style={styles.monthlyRemainingText}>
              {currentMonthCount < TARGET_MONTHLY
                ? `${(TARGET_MONTHLY - currentMonthCount).toLocaleString()} remaining`
                : "Target achieved! 🎉"}
            </Text>
          )}
          
        </View>
      </View>

      {/* Customers Data Section */}
      <View style={styles.customersSection}>
          {/* Table Rows */}
          {loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Loading...</Text>
            </View>
          ) : leads.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No customers found</Text>
            </View>
          ) : (
            (() => {
              const groupedLeads = groupLeadsByDate(leads);
              let globalIndex = 0;

              return groupedLeads.map((group) => {
                const isTodayGroup = isToday(group.date);

                return (
                  <View key={group.dateKey}>
                    {/* Date Separator - Skip for today */}
                    {!isTodayGroup && (
                      <View style={styles.dateSeparator}>
                        <Text style={styles.dateText}>
                          {formatDateWithOrdinal(group.date)}
                        </Text>
                        <Text style={styles.dateCount}>
                          {group.leads.length} registered
                        </Text>
                      </View>
                    )}

                    {/* Leads for this date */}
                    {group.leads.map((lead) => {
                      globalIndex++;
                      const isTodayLead = isToday(lead.created_at);
                      const duplicateColor = duplicateStatus[lead.id];
                      const isRed = duplicateColor === "red";
                      const isOrange = duplicateColor === "orange";
                      const isResubmitted = lead.resubmitted === true;

                      return (
                        <View key={lead.id} style={styles.tableRow}>
                          <Text style={styles.cellNumber}>{globalIndex}</Text>
                          <View style={styles.cellNameContainer}>
                            <Text
                              style={[
                                styles.cellName,
                                isTodayLead &&
                                  !isRed &&
                                  !isOrange &&
                                  !isResubmitted &&
                                  styles.cellNameToday,
                                isRed && !isResubmitted && styles.cellNameRed,
                                isOrange && !isResubmitted && styles.cellNameOrange,
                                isResubmitted && styles.cellNameResubmitted,
                              ]}
                              numberOfLines={1}
                            >
                              {formatName(lead.customer_name)}
                            </Text>
                            {isResubmitted && (
                              <View style={styles.resubmitBadge}>
                                <Text style={styles.resubmitBadgeText}>
                                  RESUBMIT
                                </Text>
                              </View>
                            )}
                          </View>
                          <View style={styles.cellNumbers}>
                            <TouchableOpacity
                              onPress={() =>
                                handleCopyNumber(
                                  lead.airtel_number,
                                  `${lead.id}-airtel`
                                )
                              }
                              onLongPress={() =>
                                handleCallNumber(lead.airtel_number)
                              }
                              delayLongPress={500}
                            >
                              <Text
                                style={styles.cellNumberText}
                                numberOfLines={1}
                              >
                                {copiedNumberId === `${lead.id}-airtel`
                                  ? "Copied"
                                  : formatPhoneNumber(lead.airtel_number)}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() =>
                                handleCopyNumber(
                                  lead.alternate_number,
                                  `${lead.id}-safaricom`
                                )
                              }
                              onLongPress={() =>
                                handleCallNumber(lead.alternate_number)
                              }
                              delayLongPress={500}
                            >
                              <Text
                                style={styles.cellNumberText}
                                numberOfLines={1}
                              >
                                {copiedNumberId === `${lead.id}-safaricom`
                                  ? "Copied"
                                  : formatPhoneNumber(lead.alternate_number)}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              });
            })()
          )}
      </View>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseModal}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={handleCloseModal}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Export Filters</Text>
              <TouchableOpacity
                onPress={handleCloseModal}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={true}
            >
              {/* Town Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Town</Text>
                <TouchableOpacity
                  style={styles.townDropdownContainer}
                  onPress={() => {
                    console.log(
                      "🏙️ Dropdown clicked, current showTownList:",
                      showTownList,
                      "availableTowns:",
                      availableTowns.length
                    );
                    setShowTownList((prev) => !prev);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.townDropdownHeader}>
                    <Text style={styles.townDropdownHeaderText}>
                      {selectedTown || "All Towns"}
                    </Text>
                    <Ionicons
                      name={showTownList ? "chevron-up" : "chevron-down"}
                      size={20}
                      color="#FFD700"
                    />
                  </View>
                </TouchableOpacity>
                {showTownList && (
                  <ScrollView
                    style={styles.townListContainer}
                    nestedScrollEnabled={true}
                    showsVerticalScrollIndicator={true}
                  >
                    <TouchableOpacity
                      style={[
                        styles.modalItem,
                        selectedTown === null && styles.modalItemActive,
                      ]}
                      onPress={() => {
                        setSelectedTown(null);
                        setShowTownList(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.modalItemText,
                          selectedTown === null && styles.modalItemTextActive,
                        ]}
                      >
                        All Towns
                      </Text>
                      {selectedTown === null && (
                        <Ionicons name="checkmark" size={20} color="#FFD700" />
                      )}
                    </TouchableOpacity>
                    {availableTowns.length === 0 ? (
                      <View style={styles.modalItem}>
                        <Text style={styles.modalItemText}>
                          No towns available
                        </Text>
                      </View>
                    ) : (
                      availableTowns.map((town) => (
                        <TouchableOpacity
                          key={town}
                          style={[
                            styles.modalItem,
                            selectedTown === town && styles.modalItemActive,
                          ]}
                          onPress={() => {
                            setSelectedTown(town);
                            setShowTownList(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.modalItemText,
                              selectedTown === town &&
                                styles.modalItemTextActive,
                            ]}
                          >
                            {town}
                          </Text>
                          {selectedTown === town && (
                            <Ionicons
                              name="checkmark"
                              size={20}
                              color="#FFD700"
                            />
                          )}
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>
                )}
              </View>

              {/* Date Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Date</Text>
                <View style={styles.dateButtonsRow}>
                  <TouchableOpacity
                    style={[
                      styles.dateButton,
                      dateFilter === "all" && styles.dateButtonSelected,
                    ]}
                    onPress={() => {
                      setDateFilter("all");
                      setSelectedDate(null);
                      setShowDatePicker(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dateButtonText,
                        dateFilter === "all" && styles.dateButtonTextSelected,
                      ]}
                    >
                      All Time
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.dateButton,
                      dateFilter === "today" && styles.dateButtonSelected,
                    ]}
                    onPress={() => {
                      setDateFilter("today");
                      setSelectedDate(null);
                      setShowDatePicker(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dateButtonText,
                        dateFilter === "today" && styles.dateButtonTextSelected,
                      ]}
                    >
                      Today
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.dateButton,
                      dateFilter === "custom" && styles.dateButtonSelected,
                    ]}
                    onPress={() => {
                      setDateFilter("custom");
                      setShowDatePicker(!showDatePicker);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dateButtonText,
                        dateFilter === "custom" &&
                          styles.dateButtonTextSelected,
                      ]}
                    >
                      {selectedDate
                        ? formatSelectedDate(selectedDate)
                        : "Custom"}
                    </Text>
                  </TouchableOpacity>
                </View>
                {dateFilter === "custom" && showDatePicker && (
                  <View style={styles.calendarWrapper}>
                    <Calendar
                      onDayPress={(day) => {
                        setSelectedDate(day.dateString);
                      }}
                      markedDates={{
                        [selectedDate || ""]: {
                          selected: true,
                          selectedColor: "#FFD700",
                          selectedTextColor: "#000000",
                        },
                      }}
                      theme={{
                        backgroundColor: "#0A0A0A",
                        calendarBackground: "#0A0A0A",
                        textSectionTitleColor: "#9CA3AF",
                        selectedDayBackgroundColor: "#FFD700",
                        selectedDayTextColor: "#000000",
                        todayTextColor: "#FFD700",
                        dayTextColor: "#FFFFFF",
                        textDisabledColor: "#4B5563",
                        dotColor: "#FFD700",
                        selectedDotColor: "#000000",
                        arrowColor: "#FFD700",
                        monthTextColor: "#FFFFFF",
                        indicatorColor: "#FFD700",
                        textDayFontFamily: "Inter_400Regular",
                        textMonthFontFamily: "Montserrat_600SemiBold",
                        textDayHeaderFontFamily: "Inter_600SemiBold",
                        textDayFontSize: 14,
                        textMonthFontSize: 16,
                        textDayHeaderFontSize: 12,
                      }}
                      enableSwipeMonths={true}
                    />
                  </View>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowFilterModal(false);
                  setPendingExportOption(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.exportButton}
                onPress={handleApplyFiltersAndExport}
              >
                <Text style={styles.exportButtonText}>Export</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
      </ScrollView>
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
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerDate: {
    fontSize: 14,
    fontFamily: "Montserrat_400Regular",
    color: "#9CA3AF",
    textTransform: "lowercase",
    flexShrink: 0,
  },
  exportContainer: {
    position: "relative",
  },
  exportIconButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255, 215, 0, 0.1)",
  },
  exportMenuOverlay: {
    position: "absolute",
    top: 40,
    right: 0,
    zIndex: 1000,
  },
  exportMenu: {
    backgroundColor: "#1A1A1A",
    borderRadius: 8,
    minWidth: 160,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  exportMenuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  exportMenuText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#FFFFFF",
  },
  exportMenuSeparator: {
    height: 1,
    backgroundColor: "#2A2A2A",
    marginHorizontal: 8,
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
    marginHorizontal: 16,
  },
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  countContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  duplicateCountText: {
    position: "absolute",
    top: -8,
    right: -20,
    color: "#EF4444", // Red color for duplicate count
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  countText: {
    fontSize: 48,
    fontFamily: "Inter_700Bold",
    color: "#FFD700", // Yellow/gold accent (Airtel brand color)
    letterSpacing: -0.5,
  },
  countTextToday: {
    fontSize: 48,
    fontFamily: "Inter_700Bold",
    color: "#10B981", // Green color for today's count
    letterSpacing: -0.5,
  },
  trendContainer: {
    flexDirection: "column",
    alignItems: "center",
    marginLeft: 8,
  },
  trendIcon: {
    marginTop: 4,
  },
  percentageText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
  percentageTextGreen: {
    color: "#10B981",
  },
  percentageTextRed: {
    color: "#EF4444",
  },
  labelText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#FFFFFF", // White text for dark background
    marginTop: 8,
    letterSpacing: 0.2,
  },
  customersSection: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 62, // Add bottom padding to avoid tab bar
  },
  customersList: {
    flex: 1,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
    width: "100%",
    alignItems: "center",
  },
  cellNumber: {
    width: 30,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
    textAlign: "left",
    flexShrink: 0,
    flexGrow: 0,
  },
  cellNameContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
    flexShrink: 1,
    minWidth: 0,
    gap: 8,
  },
  cellName: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#FFD700", // Golden color for name
    textAlign: "left",
    flexShrink: 1,
    minWidth: 0,
  },
  cellNameToday: {
    color: "#10B981", // Green color for today's registrations
  },
  cellNameRed: {
    color: "#EF4444", // Red color for duplicates
  },
  cellNameOrange: {
    color: "#FB923C", // Orange color for potential duplicates
  },
  cellNameResubmitted: {
    color: "#8B5CF6", // Purple color for resubmitted customers
  },
  resubmitBadge: {
    backgroundColor: "#8B5CF6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    flexShrink: 0,
  },
  resubmitBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  dateSeparator: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2A",
    marginTop: 8,
  },
  dateText: {
    fontSize: 14,
    fontFamily: "Montserrat_600SemiBold",
    color: "#9CA3AF",
    textTransform: "lowercase",
  },
  dateCount: {
    fontSize: 14,
    fontFamily: "Montserrat_400Regular",
    color: "#9CA3AF",
  },
  cellNumbers: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
    justifyContent: "flex-end",
    flexShrink: 0,
    width: 216, // 100 + 16 + 100
  },
  cellNumberText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#FFFFFF", // White color for numbers
    width: 100,
    textAlign: "right",
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
    maxHeight: "80%",
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
    color: "#FFD700",
  },
  modalBody: {
    maxHeight: 500,
    padding: 20,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterLabel: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
    marginBottom: 12,
  },
  townDropdownContainer: {
    marginBottom: 12,
  },
  townDropdownHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "#0A0A0A",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FFD700",
  },
  townDropdownHeaderText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#FFD700",
  },
  townListContainer: {
    maxHeight: 250,
    backgroundColor: "#0A0A0A",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    overflow: "hidden",
  },
  dateButtonsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  dateButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#0A0A0A",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    alignItems: "center",
  },
  dateButtonSelected: {
    backgroundColor: "rgba(255, 215, 0, 0.1)",
    borderColor: "#FFD700",
  },
  dateButtonText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#9CA3AF",
  },
  dateButtonTextSelected: {
    color: "#FFD700",
    fontFamily: "Inter_600SemiBold",
  },
  calendarWrapper: {
    marginTop: 12,
    backgroundColor: "#0A0A0A",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    overflow: "hidden",
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#2A2A2A",
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  cancelButtonText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#9CA3AF",
  },
  exportButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: "#FFD700",
  },
  exportButtonText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#000000",
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
    borderBottomColor: "#2A2A2A",
  },
  modalItemActive: {
    backgroundColor: "rgba(255, 215, 0, 0.1)",
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
  modalCloseButton: {
    padding: 4,
  },
  dateModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  dateModalContent: {
    backgroundColor: "#1A1A1A",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: "90%",
  },
  dateModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2A",
  },
  dateModalTitle: {
    fontSize: 18,
    fontFamily: "Montserrat_600SemiBold",
    color: "#FFFFFF",
    flex: 1,
    textAlign: "center",
  },
  dateModalCancel: {
    padding: 4,
  },
  dateModalCancelText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#9CA3AF",
  },
  dateModalDone: {
    padding: 4,
  },
  dateModalDoneText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFD700",
  },
  quickDateButton: {
    padding: 12,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
    backgroundColor: "#0A0A0A",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    alignItems: "center",
  },
  quickDateButtonText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#FFD700",
  },
  todayContainer: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 20,
    marginTop: 30,
    marginHorizontal: 20,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  todayLabel: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#9CA3AF",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  todayCount: {
    fontSize: 48,
    fontFamily: "Inter_700Bold",
    color: "#10B981",
  },
  graphContainer: {
    marginTop: 20,
    marginHorizontal: 20,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    alignItems: "center",
  },
  monthlyTitle: {
    fontSize: 18,
    fontFamily: "Montserrat_600SemiBold",
    color: "#FFD700",
    marginBottom: 12,
  },
  monthSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    gap: 16,
  },
  monthNavButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255, 215, 0, 0.1)",
  },
  monthNavButtonDisabled: {
    backgroundColor: "rgba(107, 114, 128, 0.1)",
  },
  monthName: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: "#FFD700",
    minWidth: 180,
    textAlign: "center",
    textTransform: "capitalize",
  },
  progressContainer: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 12,
  },
  progressSvg: {
    transform: [{ rotate: "-90deg" }],
  },
  progressWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  flowerDecorations: {
    position: "absolute",
    width: 280,
    height: 280,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  flower: {
    position: "absolute",
    fontSize: 28,
  },
  flowerTopLeft: {
    top: 10,
    left: 10,
  },
  flowerTopRight: {
    top: 10,
    right: 10,
  },
  flowerBottomLeft: {
    bottom: 10,
    left: 10,
  },
  flowerBottomRight: {
    bottom: 10,
    right: 10,
  },
  flowerTop: {
    top: 0,
    alignSelf: "center",
  },
  flowerBottom: {
    bottom: 0,
    alignSelf: "center",
  },
  flowerLeft: {
    left: 0,
    alignSelf: "center",
  },
  flowerRight: {
    right: 0,
    alignSelf: "center",
  },
  progressContent: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  progressNumber: {
    fontSize: 44,
    fontFamily: "Inter_700Bold",
    color: "#FFD700",
    lineHeight: 52,
  },
  progressTarget: {
    fontSize: 26,
    fontFamily: "Inter_400Regular",
    color: "#9CA3AF",
    lineHeight: 32,
  },
  progressLabel: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#9CA3AF",
    marginTop: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  progressPercentage: {
    fontSize: 24,
    fontFamily: "Inter_600SemiBold",
    color: "#FFD700",
    marginTop: 4,
  },
  monthlyInfoContainer: {
    marginTop: 12,
    alignItems: "center",
  },
  monthlyInfoText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#9CA3AF",
    textAlign: "center",
    marginBottom: 8,
  },
  monthlyRemainingText: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: "#FFD700",
    textAlign: "center",
  },
  graphTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  graphTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  graph: {
    flexDirection: "row",
    height: 200,
    alignItems: "flex-end",
  },
  yAxis: {
    width: 30,
    justifyContent: "space-between",
    paddingRight: 8,
    marginBottom: 30,
  },
  yAxisLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "#888888",
    textAlign: "right",
  },
  chartArea: {
    width: "100%",
    overflow: "hidden",
    alignItems: "center",
  },
  chartWrapper: {
    marginLeft: -40, // Hide right Y-axis by shifting left
  },
  barContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    height: "100%",
  },
  barWrapper: {
    width: "80%",
    height: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  bar: {
    width: "100%",
    backgroundColor: "#FFD700",
    borderRadius: 4,
    minHeight: 4,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 4,
  },
  barToday: {
    backgroundColor: "#10B981",
  },
  barValue: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#000000",
  },
  barLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#888888",
    marginTop: 8,
  },
  barLabelToday: {
    color: "#10B981",
    fontFamily: "Inter_600SemiBold",
  },
  barDate: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "#666666",
    marginTop: 2,
  },
  barDateToday: {
    color: "#10B981",
    fontFamily: "Inter_600SemiBold",
  },
  graphEmpty: {
    height: 220, // Match chart height
    justifyContent: "center",
    alignItems: "center",
  },
  graphEmptyText: {
    fontSize: 14,
    color: "#888888",
    fontFamily: "Inter_400Regular",
  },
  graphLoadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(26, 26, 26, 0.7)",
    justifyContent: "flex-start",
    alignItems: "center",
    borderRadius: 12,
  },
  loadingBarContainer: {
    width: "100%",
    height: 3,
    backgroundColor: "#2A2A2A",
    overflow: "hidden",
    borderRadius: 1.5,
  },
  scrollContent: {
    flex: 1,
  },
  graphHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 8,
  },
  dateRangeButtons: {
    flexDirection: "row",
    alignItems: "center",
  },
  dateRangeButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#2A2A2A",
    borderWidth: 1,
    borderColor: "#3A3A3A",
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
  },
  dateRangeButtonActive: {
    backgroundColor: "#FFD700",
    borderColor: "#FFD700",
  },
  dateRangeButtonText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#888888",
    textAlign: "center",
  },
  celebrationOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  celebrationContainer: {
    width: "85%",
    maxWidth: 400,
    alignItems: "center",
  },
  celebrationContent: {
    backgroundColor: "#1A1A1A",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFD700",
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  celebrationEmoji: {
    fontSize: 80,
    marginBottom: 16,
  },
  celebrationTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFD700",
    marginBottom: 12,
    textAlign: "center",
  },
  celebrationSubtitle: {
    fontSize: 16,
    color: "#E5E5E5",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 22,
  },
  celebrationCount: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#FFD700",
    marginBottom: 24,
  },
  celebrationButton: {
    backgroundColor: "#FFD700",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 150,
  },
  celebrationButtonText: {
    color: "#0A0A0A",
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
  },
  dateRangeButtonTextActive: {
    color: "#000000",
    fontFamily: "Inter_700Bold",
  },
  dateRangeButtonDisabled: {
    opacity: 0.5,
  },
  lineChartContainer: {
    flex: 1,
    position: "relative",
    height: "100%",
  },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#2A2A2A",
  },
  linePath: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 30,
  },
  lineSegment: {
    position: "absolute",
    backgroundColor: "#FFD700",
    borderRadius: 1.5,
    transformOrigin: "left center",
  },
  dataPointContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -12,
    marginBottom: -12,
  },
  dataPointDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFD700",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#0A0A0A",
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  dataPointDotToday: {
    backgroundColor: "#10B981",
    borderColor: "#0A0A0A",
    shadowColor: "#10B981",
  },
  dataPointValue: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#000000",
  },
  xAxis: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    height: 30,
  },
  xAxisLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "#888888",
    textAlign: "center",
  },
  xAxisLabelToday: {
    color: "#10B981",
    fontFamily: "Inter_600SemiBold",
  },
  celebrationBanner: {
    marginTop: 16,
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
  },
  celebrationBannerContent: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#FFD700",
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  celebrationBannerEmoji: {
    fontSize: 40,
    marginRight: 12,
  },
  celebrationBannerTextContainer: {
    flex: 1,
  },
  celebrationBannerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFD700",
    marginBottom: 4,
  },
  celebrationBannerSubtitle: {
    fontSize: 14,
    color: "#E5E5E5",
  },
  testCelebrationButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#2A2A2A",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FFD700",
  },
  testCelebrationButtonText: {
    color: "#FFD700",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
});
