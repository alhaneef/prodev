import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Bot, GitBranch, Zap, Database, Shield, BarChart3 } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bot className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">ProDev Platform</h1>
            </div>
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              Production Ready
            </Badge>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <div className="mb-4">
            <p className="text-lg text-gray-600 mb-2">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيم</p>
            <p className="text-sm text-gray-500">Bismillah Ar-Rahman Ar-Roheem</p>
          </div>

          <h2 className="text-5xl font-bold text-gray-900 mb-6">
            AI-Powered Autonomous
            <span className="text-blue-600 block">Development Platform</span>
          </h2>

          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Comprehensive software development capabilities with full GitHub integration, long-term memory,
            bidirectional synchronization, and intelligent deployment management.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
              Get Started
            </Button>
            <Button size="lg" variant="outline">
              View Documentation
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h3 className="text-3xl font-bold text-center mb-12">Key Features</h3>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <Bot className="h-10 w-10 text-blue-600 mb-2" />
                <CardTitle>AI-Powered Development</CardTitle>
                <CardDescription>
                  Autonomous AI agents with full context awareness and persistent memory
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Intelligent agents with context awareness</li>
                  <li>• Long-term memory capabilities</li>
                  <li>• Autonomous task execution</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <GitBranch className="h-10 w-10 text-green-600 mb-2" />
                <CardTitle>GitHub Integration</CardTitle>
                <CardDescription>Seamless repository management with bidirectional synchronization</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Full GitHub integration</li>
                  <li>• Bidirectional synchronization</li>
                  <li>• Advanced Git workflow management</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Zap className="h-10 w-10 text-yellow-600 mb-2" />
                <CardTitle>Intelligent Deployment</CardTitle>
                <CardDescription>Smart deployment strategies and multi-environment support</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Smart deployment strategies</li>
                  <li>• Multi-environment support</li>
                  <li>• Automated CI/CD integration</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Database className="h-10 w-10 text-purple-600 mb-2" />
                <CardTitle>Memory & Context</CardTitle>
                <CardDescription>Persistent storage and full project context understanding</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Full project context awareness</li>
                  <li>• Memory persistence</li>
                  <li>• Continuous learning capabilities</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Shield className="h-10 w-10 text-red-600 mb-2" />
                <CardTitle>Security</CardTitle>
                <CardDescription>Enterprise-grade security with encryption and secure workflows</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Encrypted API keys and data</li>
                  <li>• Secure OAuth flows</li>
                  <li>• Regular security audits</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <BarChart3 className="h-10 w-10 text-indigo-600 mb-2" />
                <CardTitle>Monitoring & Analytics</CardTitle>
                <CardDescription>Real-time monitoring with performance metrics and insights</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Real-time agent monitoring</li>
                  <li>• Performance metrics</li>
                  <li>• Usage statistics and insights</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Status Section */}
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-3xl font-bold mb-8">Platform Status</h3>

          <div className="grid md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-green-600 text-2xl font-bold mb-2">✅</div>
              <h4 className="font-semibold mb-1">Production Ready</h4>
              <p className="text-sm text-gray-600">Currently functional and in production</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-blue-600 text-2xl font-bold mb-2">🔄</div>
              <h4 className="font-semibold mb-1">Active Development</h4>
              <p className="text-sm text-gray-600">Continuous improvements and new features</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-purple-600 text-2xl font-bold mb-2">📈</div>
              <h4 className="font-semibold mb-1">Scaling</h4>
              <p className="text-sm text-gray-600">Ready for enterprise deployment</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-orange-600 text-2xl font-bold mb-2">🤖</div>
              <h4 className="font-semibold mb-1">AI-Enhanced</h4>
              <p className="text-sm text-gray-600">Powered by latest AI technologies</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <Bot className="h-6 w-6" />
              <span className="text-xl font-bold">ProDev Platform</span>
            </div>

            <p className="text-gray-400 mb-4">
              **Ma'Sha'Allah** - Built with dedication to excellence in software development automation.
            </p>

            <div className="text-sm text-gray-500">
              <p className="mb-2">الحمد لله رب العالمين</p>
              <p>Alhamdulillahi Rabbil Alameen</p>
            </div>

            <div className="mt-8 pt-8 border-t border-gray-800 text-center text-gray-500">
              <p>&copy; 2024 ProDev Platform. Built with Next.js and Tailwind CSS.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
