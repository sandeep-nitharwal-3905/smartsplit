import { useState } from 'react';
import { 
  Users, 
  IndianRupee, 
  TrendingUp, 
  Shield, 
  Zap, 
  Globe, 
  CheckCircle, 
  ArrowRight,
  Menu,
  X,
  Star,
  Clock,
  Smartphone,
  BarChart3
} from 'lucide-react';

interface HomePageProps {
  onGetStarted: () => void;
}

export default function HomePage({ onGetStarted }: HomePageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-blue-50">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md z-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="SmartSplit Logo" className="h-8 w-8 sm:h-10 sm:w-10" />
              <span className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent">
                SmartSplit
              </span>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-700 hover:text-teal-600 transition-colors">Features</a>
              <a href="#how-it-works" className="text-gray-700 hover:text-teal-600 transition-colors">How It Works</a>
              <a href="#benefits" className="text-gray-700 hover:text-teal-600 transition-colors">Benefits</a>
              <button 
                onClick={onGetStarted}
                className="bg-gradient-to-r from-teal-500 to-blue-500 text-white px-6 py-2 rounded-full hover:from-teal-600 hover:to-blue-600 transition-all shadow-lg hover:shadow-xl"
              >
                Get Started Free
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button 
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 space-y-3">
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block text-gray-700 hover:text-teal-600 transition-colors py-2">Features</a>
              <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="block text-gray-700 hover:text-teal-600 transition-colors py-2">How It Works</a>
              <a href="#benefits" onClick={() => setMobileMenuOpen(false)} className="block text-gray-700 hover:text-teal-600 transition-colors py-2">Benefits</a>
              <button 
                onClick={onGetStarted}
                className="w-full bg-gradient-to-r from-teal-500 to-blue-500 text-white px-6 py-2 rounded-full hover:from-teal-600 hover:to-blue-600 transition-all"
              >
                Get Started Free
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 bg-teal-100 text-teal-700 px-4 py-2 rounded-full text-sm font-semibold">
                <Star className="w-4 h-4 fill-current" />
                Trusted by 10,000+ Users
              </div>
              
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 leading-tight">
                Split Bills & Track Expenses{' '}
                <span className="bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent">
                  Effortlessly
                </span>
              </h1>
              
              <p className="text-lg sm:text-xl text-gray-600 leading-relaxed">
                Stop the awkward money conversations. SmartSplit makes splitting bills with friends, 
                roommates, and groups as simple as a few taps. Track who owes what, settle up instantly, 
                and keep your friendships drama-free.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={onGetStarted}
                  className="bg-gradient-to-r from-teal-500 to-blue-500 text-white px-8 py-4 rounded-full text-lg font-semibold hover:from-teal-600 hover:to-blue-600 transition-all shadow-xl hover:shadow-2xl flex items-center justify-center gap-2 group"
                >
                  Start Splitting Now
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
                <button className="border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-full text-lg font-semibold hover:border-teal-500 hover:text-teal-600 transition-all">
                  Watch Demo
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-4 sm:gap-8 pt-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600" />
                  <span className="text-sm sm:text-base text-gray-600">100% Free</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600" />
                  <span className="text-sm sm:text-base text-gray-600">No Credit Card</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600" />
                  <span className="text-sm sm:text-base text-gray-600">Instant Setup</span>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-teal-400 to-blue-400 rounded-3xl blur-3xl opacity-20"></div>
              <img 
                src="/Clean_UI_dashboard.png" 
                alt="SmartSplit Dashboard Interface" 
                className="relative rounded-2xl shadow-2xl border-4 border-white w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Split Smart
            </h2>
            <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
              Powerful features designed to make expense sharing simple, fair, and transparent
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            <div className="bg-gradient-to-br from-teal-50 to-blue-50 p-6 sm:p-8 rounded-2xl hover:shadow-xl transition-shadow">
              <div className="w-14 h-14 bg-gradient-to-r from-teal-500 to-blue-500 rounded-xl flex items-center justify-center mb-4">
                <Users className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Group Expenses</h3>
              <p className="text-gray-600">
                Create groups for roommates, trips, events, or any shared expenses. Keep everyone in sync effortlessly.
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-6 sm:p-8 rounded-2xl hover:shadow-xl transition-shadow">
              <div className="w-14 h-14 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center mb-4">
                <IndianRupee className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Smart Splitting</h3>
              <p className="text-gray-600">
                Split equally, by percentage, or custom amounts. SmartSplit calculates who owes what automatically.
              </p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 sm:p-8 rounded-2xl hover:shadow-xl transition-shadow">
              <div className="w-14 h-14 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mb-4">
                <TrendingUp className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Real-Time Tracking</h3>
              <p className="text-gray-600">
                See your balances update instantly. Know exactly who owes you and who you owe at all times.
              </p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-red-50 p-6 sm:p-8 rounded-2xl hover:shadow-xl transition-shadow">
              <div className="w-14 h-14 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center mb-4">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Secure & Private</h3>
              <p className="text-gray-600">
                Your financial data is encrypted and secure. We never share your information with third parties.
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-teal-50 p-6 sm:p-8 rounded-2xl hover:shadow-xl transition-shadow">
              <div className="w-14 h-14 bg-gradient-to-r from-green-500 to-teal-500 rounded-xl flex items-center justify-center mb-4">
                <Zap className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Lightning Fast</h3>
              <p className="text-gray-600">
                Add expenses in seconds. Our intuitive interface gets you in and out quickly.
              </p>
            </div>

            <div className="bg-gradient-to-br from-cyan-50 to-blue-50 p-6 sm:p-8 rounded-2xl hover:shadow-xl transition-shadow">
              <div className="w-14 h-14 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center mb-4">
                <Globe className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Multi-Currency</h3>
              <p className="text-gray-600">
                Support for Indian Rupees and multiple currencies. Perfect for international trips.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              How SmartSplit Works
            </h2>
            <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
              Get started in three simple steps
            </p>
          </div>

          <div className="grid sm:grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12">
            <div className="text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-r from-teal-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl sm:text-3xl font-bold">
                1
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">Create a Group</h3>
              <p className="text-gray-600 text-base sm:text-lg">
                Add your friends, roommates, or trip buddies to a group in seconds.
              </p>
              <div className="mt-6">
                <img 
                  src="/Friendly_illustration.png" 
                  alt="Create Group Illustration" 
                  className="rounded-xl shadow-lg mx-auto w-48 h-48 object-cover"
                />
              </div>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl sm:text-3xl font-bold">
                2
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">Add Expenses</h3>
              <p className="text-gray-600 text-base sm:text-lg">
                Log expenses as they happen. Split equally or customize who owes what.
              </p>
              <div className="mt-6">
                <img 
                  src="/Minimalist_abstract.png" 
                  alt="Add Expenses Illustration" 
                  className="rounded-xl shadow-lg mx-auto w-48 h-48 object-cover"
                />
              </div>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl sm:text-3xl font-bold">
                3
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">Settle Up</h3>
              <p className="text-gray-600 text-base sm:text-lg">
                View balances and settle debts. SmartSplit shows the simplest way to square up.
              </p>
              <div className="mt-6">
                <img 
                  src="/Abstract_pastel_grad.png" 
                  alt="Settle Up Illustration" 
                  className="rounded-xl shadow-lg mx-auto w-48 h-48 object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8 sm:gap-12 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
                Why Choose SmartSplit?
              </h2>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-teal-600" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Save Time</h3>
                    <p className="text-sm sm:text-base text-gray-600">
                      No more spreadsheets or manual calculations. SmartSplit does the math for you instantly.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <Smartphone className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Use Anywhere</h3>
                    <p className="text-sm sm:text-base text-gray-600">
                      Works perfectly on all devices - desktop, tablet, and mobile. Split on the go!
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Stay Organized</h3>
                    <p className="text-sm sm:text-base text-gray-600">
                      Keep all your shared expenses in one place. View history and export reports anytime.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <Users className="w-6 h-6 sm:w-8 sm:h-8 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Better Relationships</h3>
                    <p className="text-sm sm:text-base text-gray-600">
                      Clear tracking means no misunderstandings. Keep money matters transparent and fair.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 rounded-3xl blur-3xl opacity-20"></div>
              <img 
                src="/Clean_UI_dashboard.png" 
                alt="SmartSplit Benefits" 
                className="relative rounded-2xl shadow-2xl border-4 border-white"
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-20 bg-gradient-to-r from-teal-600 to-blue-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 sm:mb-6">
            Ready to Simplify Your Shared Expenses?
          </h2>
          <p className="text-lg sm:text-xl text-teal-100 mb-6 sm:mb-8">
            Join thousands of users who trust SmartSplit for hassle-free expense splitting
          </p>
          <button 
            onClick={onGetStarted}
            className="bg-white text-teal-600 px-8 sm:px-10 py-3 sm:py-4 rounded-full text-base sm:text-lg font-bold hover:bg-gray-100 transition-all shadow-xl hover:shadow-2xl inline-flex items-center gap-2 group"
          >
            Get Started Free
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
          <p className="text-sm sm:text-base text-teal-100 mt-4">
            No credit card required • Set up in 2 minutes • 100% Free
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img src="/logo.png" alt="SmartSplit Logo" className="h-8 w-8" />
                <span className="text-xl font-bold text-white">SmartSplit</span>
              </div>
              <p className="text-gray-400">
                Making expense splitting simple, fair, and transparent for everyone.
              </p>
            </div>
            
            <div>
              <h3 className="text-white font-bold mb-4">Product</h3>
              <ul className="space-y-2">
                <li><a href="#features" className="hover:text-teal-400 transition-colors">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-teal-400 transition-colors">How It Works</a></li>
                <li><a href="#benefits" className="hover:text-teal-400 transition-colors">Benefits</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-white font-bold mb-4">Company</h3>
              <ul className="space-y-2">
                <li><a href="#" className="hover:text-teal-400 transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-teal-400 transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-teal-400 transition-colors">Terms of Service</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-white font-bold mb-4">Support</h3>
              <ul className="space-y-2">
                <li><a href="#" className="hover:text-teal-400 transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-teal-400 transition-colors">Contact Us</a></li>
                <li><a href="#" className="hover:text-teal-400 transition-colors">FAQ</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 SmartSplit. All rights reserved.</p>
            <p>Developed & designed with <span className="text-red-500">❤</span> by Sandeep Nitharwal</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
