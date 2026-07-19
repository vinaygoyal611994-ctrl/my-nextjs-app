import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

declare module "next-auth" {
  interface Session {
    user: {
      id: number;
      name: string;
      mobile: string;
      role: "malik" | "munim";
      firmId: number;
      firmName: string;
    };
  }
  interface User {
    id: number;
    name: string;
    mobile: string;
    role: "malik" | "munim";
    firmId: number;
    firmName: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: number;
    mobile: string;
    role: "malik" | "munim";
    firmId: number;
    firmName: string;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Mobile & Password",
      credentials: {
        mobile: { label: "Mobile", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.mobile || !credentials?.password) return null;

        const user = await prisma.user.findFirst({
          where: { mobile: credentials.mobile, active: true },
          include: { firm: true },
        });

        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          mobile: user.mobile,
          role: user.role as "malik" | "munim",
          firmId: user.firmId,
          firmName: user.firm.name,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.mobile = user.mobile;
        token.role = user.role;
        token.firmId = user.firmId;
        token.firmName = user.firmName;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        id: token.id,
        name: token.name ?? "",
        mobile: token.mobile,
        role: token.role,
        firmId: token.firmId,
        firmName: token.firmName,
      };
      return session;
    },
  },
};
