import Link from "next/link";
import { ArrowRight, ShoppingBag, Calendar, CreditCard, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-sky-50 via-white to-white">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-sky-100/50 bg-white/70 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-sky-500 p-2 rounded-xl text-white shadow-md shadow-sky-200">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <span className="font-extrabold text-xl tracking-tight text-neutral-900">
            Co<span className="text-sky-500">Buy</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm font-semibold text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            Đăng nhập
          </Link>
          <Link
            href="/register"
            className="text-sm font-bold bg-sky-500 text-white px-4 py-2 rounded-xl shadow-md shadow-sky-200 hover:bg-sky-600 transition-colors"
          >
            Đăng ký
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sky-50 text-sky-600 text-xs font-bold mb-6 animate-pulse">
          <Sparkles className="w-3.5 h-3.5" />
          Ứng dụng PWA quản lý sinh hoạt nhóm
        </div>
        
        <h1 className="text-4xl sm:text-6xl font-extrabold text-neutral-900 tracking-tight leading-tight mb-6">
          Đi chợ thông thái,<br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-500 to-indigo-500">
            Chia tiền công bằng!
          </span>
        </h1>
        
        <p className="text-neutral-600 text-lg max-w-lg mb-8 leading-relaxed">
          Ứng dụng đắc lực cho gia đình, bạn cùng phòng hoặc nhóm du lịch ghi chép chi tiêu, điểm danh bữa ăn và quyết toán tiền bạc minh bạch tuyệt đối.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center max-w-md mb-12">
          <Link
            href="/register"
            className="flex items-center justify-center gap-2 bg-neutral-900 text-white py-3.5 px-8 rounded-2xl font-bold shadow-lg shadow-neutral-300 hover:bg-neutral-800 transition-all transform hover:-translate-y-0.5"
          >
            Bắt đầu ngay miễn phí
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="flex items-center justify-center bg-white border border-neutral-200 text-neutral-800 py-3.5 px-8 rounded-2xl font-bold hover:bg-neutral-50 transition-all"
          >
            Xem demo / Đăng nhập
          </Link>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-8">
          <div className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm flex flex-col items-center">
            <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center mb-4">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-neutral-800 mb-2">Ghi nhận đi chợ nhanh</h3>
            <p className="text-sm text-neutral-500 text-center">
              Nhập nhanh chi tiêu đi chợ hàng ngày. Hỗ trợ phân loại chi phí Bữa ăn hoặc Dùng chung (nước giặt, dầu ăn...).
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm flex flex-col items-center">
            <div className="w-12 h-12 rounded-xl bg-green-50 text-green-500 flex items-center justify-center mb-4">
              <Calendar className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-neutral-800 mb-2">Điểm danh ăn thông minh</h3>
            <p className="text-sm text-neutral-500 text-center">
              Điểm danh Sáng - Trưa - Tối tiện lợi. Tự động loại trừ thành viên tham gia hoặc rời nhóm giữa tháng.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm flex flex-col items-center">
            <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-500 flex items-center justify-center mb-4">
              <CreditCard className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-neutral-800 mb-2">Tối ưu hóa quyết toán</h3>
            <p className="text-sm text-neutral-500 text-center">
              Áp dụng thuật toán Greedy thông minh giúp giảm thiểu tối đa số giao dịch chuyển tiền qua lại trong nhóm.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 text-center text-xs text-neutral-400 border-t border-neutral-100 mt-12 bg-neutral-50/50">
        <p>&copy; {new Date().getFullYear()} CoBuy. Thiết kế chuẩn Production-Ready và Bảo mật cao.</p>
      </footer>
    </div>
  );
}
