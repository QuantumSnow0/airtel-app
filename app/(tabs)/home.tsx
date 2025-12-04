import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useEffect, useState } from "react";
import {
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getSupabaseClient, isSupabaseConfigured } from "../../lib/supabase";

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
}

export default function HomeScreen() {
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [todayCount, setTodayCount] = useState<number | null>(null);
  const [yesterdayCount, setYesterdayCount] = useState<number | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedNumberId, setCopiedNumberId] = useState<string | null>(null);
  const [duplicateStatus, setDuplicateStatus] = useState<{
    [key: string]: "red" | "orange" | null;
  }>({});
  const [duplicateCount, setDuplicateCount] = useState<number>(0);

  useEffect(() => {
    if (isSupabaseConfigured) {
      fetchCounts();

      // Set up Realtime subscription
      const supabase = getSupabaseClient();
      const channel = supabase
        .channel("leads-changes")
        .on(
          "postgres_changes",
          {
            event: "*", // Listen to all events (INSERT, UPDATE, DELETE)
            schema: "public",
            table: "leads",
          },
          (payload) => {
            // Refetch counts when any change occurs (without showing loading)
            fetchCounts(false);
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

      // Fetch total count
      const { count: total, error: totalError } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true });

      if (totalError) {
        console.error("Error fetching total count:", totalError);
        setTotalCount(0);
      } else {
        setTotalCount(total || 0);
      }

      // Fetch today's count
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      const todayStart = todayDate.toISOString();
      const tomorrow = new Date(todayDate);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStart = tomorrow.toISOString();

      const { count: todayCount, error: todayError } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .gte("created_at", todayStart)
        .lt("created_at", tomorrowStart);

      if (todayError) {
        console.error("Error fetching today's count:", todayError);
        setTodayCount(0);
      } else {
        setTodayCount(todayCount || 0);
      }

      // Fetch yesterday's count
      const yesterdayDate = new Date(todayDate);
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterdayStart = yesterdayDate.toISOString();

      const { count: yesterdayCount, error: yesterdayError } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .gte("created_at", yesterdayStart)
        .lt("created_at", todayStart);

      if (yesterdayError) {
        console.error("Error fetching yesterday's count:", yesterdayError);
        setYesterdayCount(0);
      } else {
        setYesterdayCount(yesterdayCount || 0);
      }

      // Fetch leads data with all fields needed for duplicate detection
      const { data: leadsData, error: leadsError } = await supabase
        .from("leads")
        .select(
          "id, customer_name, airtel_number, alternate_number, email, preferred_package, installation_town, delivery_landmark, visit_date, visit_time, agent_type, enterprise_cp, agent_name, agent_mobile, lead_type, connection_type, created_at"
        )
        .order("created_at", { ascending: false });

      if (leadsError) {
        console.error("Error fetching leads:", leadsError);
        setLeads([]);
      } else {
        setLeads(leadsData || []);
      }
    } catch (error) {
      console.error("Error:", error);
      setTotalCount(0);
      setTodayCount(0);
      setLeads([]);
    } finally {
      if (showLoading) {
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

  // Check duplicate status for a lead
  const checkDuplicateStatus = (
    currentLead: Lead,
    allLeads: Lead[]
  ): "red" | "orange" | null => {
    for (const otherLead of allLeads) {
      // Skip comparing with itself
      if (currentLead.id === otherLead.id) continue;

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

  // Check if two leads are duplicates of each other
  const areLeadsDuplicates = (lead1: Lead, lead2: Lead): boolean => {
    if (lead1.id === lead2.id) return false;
    const status = checkDuplicateStatus(lead1, [lead2]);
    return status === "red" || status === "orange";
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

        if (areLeadsDuplicates(lead, otherLead)) {
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

  // Calculate duplicate status for all leads
  useEffect(() => {
    if (leads.length > 0) {
      const status: { [key: string]: "red" | "orange" | null } = {};
      leads.forEach((lead) => {
        status[lead.id] = checkDuplicateStatus(lead, leads);
      });
      setDuplicateStatus(status);

      // Count unique duplicate groups (only count extras, not all duplicates)
      const duplicateGroups = groupDuplicates(leads);
      let totalExtras = 0;
      duplicateGroups.forEach((group) => {
        // For each group, count (group size - 1) as extras
        // e.g., if 2 identical records, count 1 extra; if 3 identical, count 2 extras
        totalExtras += group.length - 1;
      });
      setDuplicateCount(totalExtras);
    } else {
      setDuplicateCount(0);
    }
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Section */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Airtel Dashboard</Text>
        <Text style={styles.headerDate}>{formatDate()}</Text>
      </View>

      {/* Main Content */}
      <View style={styles.statsRow}>
        {/* Left: Registered Today */}
        <View style={styles.statItem}>
          <View style={styles.countRow}>
            {loading ? (
              <Text style={styles.countTextToday}>-</Text>
            ) : (
              <Text style={styles.countTextToday}>
                {todayCount !== null ? todayCount : 0}
              </Text>
            )}
            {!loading && todayCount !== null && yesterdayCount !== null && (
              <View style={styles.trendContainer}>
                <Ionicons
                  name={
                    todayCount > yesterdayCount
                      ? "trending-up"
                      : "trending-down"
                  }
                  size={20}
                  color={todayCount > yesterdayCount ? "#10B981" : "#EF4444"}
                  style={styles.trendIcon}
                />
                {yesterdayCount > 0 && (
                  <Text
                    style={[
                      styles.percentageText,
                      todayCount > yesterdayCount
                        ? styles.percentageTextGreen
                        : styles.percentageTextRed,
                    ]}
                  >
                    {Math.abs(
                      Math.round(
                        ((todayCount - yesterdayCount) / yesterdayCount) * 100
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
            <View style={styles.countContainer}>
              <Text style={styles.countText}>
                {totalCount !== null ? totalCount : 0}
              </Text>
              {duplicateCount > 0 && (
                <Text style={styles.duplicateCountText}>-{duplicateCount}</Text>
              )}
            </View>
          )}
          <Text style={styles.labelText}>total registered</Text>
        </View>
      </View>

      {/* Customers Data Section */}
      <View style={styles.customersSection}>
        <ScrollView
          style={styles.customersList}
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

                      return (
                        <View key={lead.id} style={styles.tableRow}>
                          <Text style={styles.cellNumber}>{globalIndex}</Text>
                          <Text
                            style={[
                              styles.cellName,
                              isTodayLead &&
                                !isRed &&
                                !isOrange &&
                                styles.cellNameToday,
                              isRed && styles.cellNameRed,
                              isOrange && styles.cellNameOrange,
                            ]}
                            numberOfLines={1}
                          >
                            {formatName(lead.customer_name)}
                          </Text>
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
        </ScrollView>
      </View>
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
  cellName: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#FFD700", // Golden color for name
    marginRight: 16,
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
});
