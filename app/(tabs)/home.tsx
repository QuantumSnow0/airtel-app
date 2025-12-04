import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1">
        <View className="p-6">
          <Text className="text-3xl font-bold text-gray-900 mb-2">
            Admin Dashboard
          </Text>
          <Text className="text-gray-600 mb-6">
            Welcome to your Airtel Router admin panel
          </Text>

          {/* Stats Cards */}
          <View className="flex-row flex-wrap gap-4 mb-6">
            <View className="bg-blue-50 p-4 rounded-lg flex-1 min-w-[150px]">
              <Text className="text-gray-600 text-sm mb-1">Total Customers</Text>
              <Text className="text-2xl font-bold text-blue-600">0</Text>
            </View>
            <View className="bg-green-50 p-4 rounded-lg flex-1 min-w-[150px]">
              <Text className="text-gray-600 text-sm mb-1">Active Routers</Text>
              <Text className="text-2xl font-bold text-green-600">0</Text>
            </View>
          </View>

          {/* Recent Activity */}
          <View className="bg-gray-50 p-4 rounded-lg">
            <Text className="text-lg font-semibold text-gray-900 mb-3">
              Recent Activity
            </Text>
            <Text className="text-gray-500">No recent activity</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

