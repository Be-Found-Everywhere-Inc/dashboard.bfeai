// JWT token generation and verification for SSO

import jwt, { SignOptions } from "jsonwebtoken";
import crypto from "crypto";

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  exp: number;
  iat: number;
  jti: string;
  fingerprint?: string;
}

export class JWTService {
  private static readonly ACCESS_TOKEN_EXPIRY = "15m" as const;
  private static readonly REFRESH_TOKEN_EXPIRY = "7d" as const;
  private static readonly SSO_TOKEN_EXPIRY = "7d" as const; // For cross-subdomain SSO

  /**
   * Generate SSO token for .bfeai.com domain
   * This token will be stored in a cookie and used across all subdomains
   */
  static generateSSOToken(userId: string, email: string, role: string = "user"): string {
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured");
    }

    const payload = {
      userId,
      email,
      role,
      jti: crypto.randomBytes(16).toString("hex"),
    };

    const options: SignOptions = {
      expiresIn: this.SSO_TOKEN_EXPIRY,
      issuer: "accounts.bfeai.com",
      audience: "*.bfeai.com",
    };

    return jwt.sign(payload, process.env.JWT_SECRET, options);
  }

  /**
   * Verify SSO token
   */
  static verifySSOToken(token: string): JWTPayload {
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured");
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: "accounts.bfeai.com",
        audience: "*.bfeai.com",
      }) as JWTPayload;

      return decoded;
    } catch (error) {
      throw new Error("Invalid or expired token");
    }
  }

  /**
   * Generate access and refresh token pair with fingerprinting
   */
  static generateTokenPair(
    userId: string,
    email: string,
    role: string,
    fingerprint: string
  ): { accessToken: string; refreshToken: string } {
    if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
      throw new Error("JWT secrets are not configured");
    }

    const fingerprintHash = crypto
      .createHash("sha256")
      .update(fingerprint)
      .digest("hex");

    const accessOptions: SignOptions = {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
      issuer: "accounts.bfeai.com",
      audience: "*.bfeai.com",
    };

    const accessToken = jwt.sign(
      {
        userId,
        email,
        role,
        type: "access",
        fingerprint: fingerprintHash,
        jti: crypto.randomBytes(16).toString("hex"),
      },
      process.env.JWT_ACCESS_SECRET,
      accessOptions
    );

    const refreshOptions: SignOptions = {
      expiresIn: this.REFRESH_TOKEN_EXPIRY,
      issuer: "accounts.bfeai.com",
    };

    const refreshToken = jwt.sign(
      {
        userId,
        email,
        role,
        type: "refresh",
        fingerprint: fingerprintHash,
        jti: crypto.randomBytes(16).toString("hex"),
      },
      process.env.JWT_REFRESH_SECRET,
      refreshOptions
    );

    return { accessToken, refreshToken };
  }

  /**
   * Verify access token with fingerprint
   */
  static verifyAccessToken(token: string, fingerprint: string): JWTPayload {
    if (!process.env.JWT_ACCESS_SECRET) {
      throw new Error("JWT_ACCESS_SECRET is not configured");
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
        issuer: "accounts.bfeai.com",
        audience: "*.bfeai.com",
      }) as JWTPayload;

      // Verify fingerprint
      const fingerprintHash = crypto
        .createHash("sha256")
        .update(fingerprint)
        .digest("hex");

      if (decoded.fingerprint !== fingerprintHash) {
        throw new Error("Invalid token fingerprint");
      }

      return decoded;
    } catch (error) {
      throw new Error("Invalid or expired access token");
    }
  }

  /**
   * Verify refresh token
   */
  static verifyRefreshToken(token: string, fingerprint: string): JWTPayload {
    if (!process.env.JWT_REFRESH_SECRET) {
      throw new Error("JWT_REFRESH_SECRET is not configured");
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET, {
        issuer: "accounts.bfeai.com",
      }) as JWTPayload;

      // Verify fingerprint
      const fingerprintHash = crypto
        .createHash("sha256")
        .update(fingerprint)
        .digest("hex");

      if (decoded.fingerprint !== fingerprintHash) {
        throw new Error("Invalid token fingerprint");
      }

      return decoded;
    } catch (error) {
      throw new Error("Invalid or expired refresh token");
    }
  }

  /**
   * Decode token without verification (use for reading payload only)
   */
  static decodeToken(token: string): JWTPayload | null {
    try {
      return jwt.decode(token) as JWTPayload;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  static isTokenExpired(token: string): boolean {
    const payload = this.decodeToken(token);
    if (!payload) return true;

    return payload.exp * 1000 < Date.now();
  }
}
