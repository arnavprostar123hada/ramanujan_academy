import { GrowthOS } from "@/components/admin/GrowthOS";

interface AdminDashboardProps {
  mode?: "admin" | "owner";
}

const AdminDashboard = (_props: AdminDashboardProps) => {
  return <GrowthOS />;
};

export default AdminDashboard;
