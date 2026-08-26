import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

const OrderSummary = () => {
  const { customerId } = useParams();
  const [data, setData] = useState({ customer: null, orders: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    fetch(`https://ratilalsons-backend-api.onrender.com/api/customers/${customerId}/orders`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => {
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("Customer does not exist in the system.");
          }
          throw new Error('Failed to fetch order summary');
        }
        return res.json();
      })
      .then(json => {
        setData({ customer: json.customer, orders: json.orders });
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || "Failed to fetch order summary");
        setLoading(false);
      });
  }, [customerId]);

  if (loading) return <p className="p-4 text-gray-500">Loading order summary...</p>;
  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-4 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="bg-white p-10 rounded-2xl shadow border border-slate-100/60 text-center max-w-md w-full">
          <div className="bg-slate-50 w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-6">
            <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-3">Record Not Found</h2>
          <p className="text-slate-500 mb-8 leading-relaxed">
            {error === "Customer does not exist in the system." ? "This customer does not exist in the system or may have been removed." : error}
          </p>
          <Link
            to="/inventory?tab=logs"
            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-medium rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all shadow-sm hover:shadow"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Inventory
          </Link>
        </div>
      </div>
    );
  }

  const { customer, orders } = data;

  return (
    <div className="max-w-7xl mx-auto p-2">

      {/* Back Button */}
      <div className="max-w-7xl mx-auto px-4 pt-5 flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold px-1 mb-4">Order Summary</h1>
        <Link
          to="/inventory?tab=logs"
          className="inline-block px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-300 transition ml-4"
        >
          ← Back to Inventory
        </Link>
      </div>

      {/* Customer Details */}
      <section className="p-5 border rounded-2xl shadow bg-gradient-to-br from-blue-50 via-white to-green-50 border-blue-100 overflow-x-auto mb-8">
        <h2 className="text-xl font-semibold text-blue-700 mb-4 flex items-center">
          <svg className="w-7 h-7 mr-2 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A15.954 15.954 0 0112 16c2.092 0 4.09.355 5.879.804M15 11a3 3 0 11-6 0 3 3 0 016 0zm7 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Customer Information
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-8 text-sm">
          <div><span className="text-blue-600 font-semibold">Name:</span> <span className="text-gray-700 font-medium">{customer.name || "N/A"}</span></div>
          <div><span className="text-blue-600 font-semibold">Email:</span> <span className="text-gray-700">{customer.email || "N/A"}</span></div>
          <div><span className="text-blue-600 font-semibold">Phone:</span> <span className="text-gray-700">{customer.phone || "N/A"}</span></div>
          <div><span className="text-blue-600 font-semibold">City:</span> <span className="text-gray-700">{customer.city || "N/A"}</span></div>
          <div><span className="text-blue-600 font-semibold">Customer ID:</span> <span className="text-gray-700">{customer.id || "N/A"}</span></div>
          <div><span className="text-blue-600 font-semibold">Total Orders:</span> <span className="text-gray-500 font-semibold">{orders.length || "N/A"}</span></div>
        </div>
      </section>

      {/* Order List */}
      <section className="p-4 border rounded-2xl shadow bg-white border border-blue-100 overflow-x-auto mb-8">
        <h2 className="text-xl font-bold text-blue-700 mb-2">Order Details</h2><br></br>
        {orders.length === 0 ? (
          <p>No orders found.</p>
        ) : (
          <table className="min-w-[350px] sm:min-w-[600px] md:min-w-[860px] w-full text-xs sm:text-[0.92rem]">
            <thead className="bg-gradient-to-r from-blue-50 to-green-50">
              <tr>
                <th className="px-2 sm:px-4 py-2 text-left text-xs font-semibold text-blue-700 uppercase">Order ID</th>
                <th className="px-2 sm:px-4 py-2 text-left text-xs font-semibold text-blue-700 uppercase">Item Name</th>
                <th className="px-2 sm:px-4 py-2 text-left text-xs font-semibold text-blue-700 uppercase">Quantity</th>
                <th className="px-2 sm:px-4 py-2 text-left text-xs font-semibold text-blue-700 uppercase">Unit Price</th>
                <th className="px-2 sm:px-4 py-2 text-left text-xs font-semibold text-blue-700 uppercase">Total Amount</th>
                <th className="px-2 sm:px-4 py-2 text-left text-xs font-semibold text-blue-700 uppercase">Order Date</th>
                <th className="px-2 sm:px-4 py-2 text-left text-xs font-semibold text-blue-700 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {orders.map(order => (
                <tr key={order.order_id || order.id} className="odd:bg-gray-50">
                  <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-500">{order.order_id || order.id}</td>
                  <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-500">{order.item_name}</td>
                  <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-500">{order.quantity}</td>
                  <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-500">{order.price}</td>
                  <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-500">{order.total_amount}</td>
                  <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-500">{new Date(order.order_date).toLocaleDateString()}</td>
                  <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-500 capitalize">{order.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};

export default OrderSummary;
