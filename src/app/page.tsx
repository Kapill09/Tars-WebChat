import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SignInButton, SignUpButton } from "@clerk/nextjs";

export default async function LandingPage() {
  const session = await auth();

  // Redirect signed-in users immediately to the chat application
  if (session?.userId) {
    redirect("/chat");
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-50 to-white text-center px-4">
      <div className="max-w-2xl mx-auto flex flex-col items-center">
        <div className="w-20 h-20 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-4xl shadow-lg mb-8">
          💬
        </div>
        <h1 className="text-5xl font-extrabold text-gray-900 mb-6 tracking-tight">
          Welcome to Tars Web Chat
        </h1>
        <p className="text-xl text-gray-600 mb-10 max-w-lg leading-relaxed">
          A modern, real-time messaging experience built for speed and simplicity.
          Sign in to connect with friends instantly.
        </p>

        <div className="flex items-center gap-4">
          <SignInButton mode="modal">
            <Button size="lg" className="px-8 py-6 text-lg rounded-full font-semibold shadow-lg hover:shadow-xl transition-all bg-indigo-600 hover:bg-indigo-700">
              Sign In
            </Button>
          </SignInButton>
          <SignUpButton mode="modal">
            <Button size="lg" variant="outline" className="px-8 py-6 text-lg rounded-full font-semibold shadow-sm transition-all border-gray-300">
              Create Account
            </Button>
          </SignUpButton>
        </div>
      </div>
    </div>
  );
}
