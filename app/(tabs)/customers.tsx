import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect } from "react";
import { getSupabaseClient, isSupabaseConfigured } from "../../lib/supabase";

export default function CustomersScreen() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isSupabaseConfigured) {
      fetchCustomers();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchCustomers = async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const supabase = getSupabaseClient();
      // TODO: Replace 'customers' with your actual Supabase table name
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching customers:", error);
        return;
      }

      setCustomers(data || []);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 border-b border-gray-200">
        <Text className="text-3xl font-bold text-gray-900 mb-2">
          Customers
        </Text>
        <Text className="text-gray-600">
          Manage your customer database
        </Text>
      </View>

      <ScrollView className="flex-1">
        {!isSupabaseConfigured ? (
          <View className="flex-1 items-center justify-center py-20 px-6">
            <Ionicons name="warning-outline" size={64} color="#F59E0B" />
            <Text className="text-gray-900 mt-4 text-center text-lg font-semibold">
              Supabase Not Configured
            </Text>
            <Text className="text-gray-600 mt-2 text-center text-sm">
              Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file
            </Text>
          </View>
        ) : loading ? (
          <View className="flex-1 items-center justify-center py-20">
            <Text className="text-gray-500">Loading customers...</Text>
          </View>
        ) : customers.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20">
            <Ionicons name="people-outline" size={64} color="#9CA3AF" />
            <Text className="text-gray-500 mt-4 text-center">
              No customers found
            </Text>
            <Text className="text-gray-400 mt-2 text-center text-sm">
              Customers will appear here once added
            </Text>
          </View>
        ) : (
          <View className="p-4">
            {customers.map((customer) => (
              <TouchableOpacity
                key={customer.id}
                className="bg-white border border-gray-200 rounded-lg p-4 mb-3 shadow-sm"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-lg font-semibold text-gray-900">
                      {customer.name || customer.email || "Customer"}
                    </Text>
                    {customer.email && (
                      <Text className="text-gray-600 mt-1">{customer.email}</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

