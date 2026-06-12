# GlassVault

<div align="center">

[![Build Status](https://img.shields.io/github/actions/workflow/status/JaDi03/GlassVault/ci.yml?branch=main&style=for-the-badge&logo=githubactions&logoColor=white)](https://github.com/JaDi03/GlassVault/actions)
[![Version](https://img.shields.io/badge/version-0.1.0-6366f1?style=for-the-badge)](https://github.com/JaDi03/GlassVault)
[![License](https://img.shields.io/badge/license-MIT-8b5cf6?style=for-the-badge)](./LICENSE)
[![Node](https://img.shields.io/badge/node-24.x-10b981?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)

[![MetaMask](https://img.shields.io/badge/MetaMask_Smart_Accounts-ERC--7715-E2761B?style=for-the-badge&logo=ethereum&logoColor=white)](https://metamask.io)
[![1Shot](https://img.shields.io/badge/1Shot_API-ERC--7710_Relay-239aaa?style=for-the-badge)](https://1shotapi.com)
[![Venice AI](https://img.shields.io/badge/Venice_AI-Private_LLM-125DA3?style=for-the-badge)](https://venice.ai)

**_Your personal on-chain finance agent - private, gasless, and multi-chain._**

> **TL;DR:** GlassVault lets you control your on-chain wallet in plain English.
> Tell it "swap 0.01 ETH for USDC" and it parses your intent with Venice AI,
> asks for your approval, then executes gaslessly using MetaMask Smart Accounts
> (ERC-7715 scoped permissions + ERC-7710 delegation via 1Shot relay) - no keys handed over, ever.

---

</div>

## Table of Contents

- [Key Features](#-key-features)
- [Hackathon Resource Integrations](#-hackathon-resource-integrations)
- [How It Works](#-how-it-works)
- [Supported Networks](#-supported-networks)
- [Quick Start](#-quick-start)
- [Project Structure](#-project-structure)
- [Tech Stack](#-tech-stack)

---

## 🚀 Hackathon Resource Integrations

GlassVault is built to showcase the bleeding edge of Ethereum account abstraction using the provided hackathon resources. Here is how we integrated each core component:

### 1. MetaMask Smart Accounts Kit & EIP-7715 (Advanced Permissions)
Instead of forcing users to sign every single transaction or give up their private keys, GlassVault uses the **MetaMask Smart Accounts Kit** to request **Advanced Permissions (EIP-7715)**. 
- **How it works:** When you connect your wallet, GlassVault calls `wallet_requestExecutionPermissions`. MetaMask opens a native, human-readable popup asking the user to authorize a specific scoped action (e.g., `erc20-token-periodic` for USDC transfers).
- **Result:** The Agent receives a cryptographic `PermissionContext` that allows it to execute on behalf of the user, strictly within the boundaries set by the user.

### 2. ERC-7710 Delegation & 1Shot Relayer (Gasless Execution)
Once the Agent has the permission context, it needs to execute the transaction without making the user pay for gas. We achieve this using the **1Shot API** and **ERC-7710 (Delegated Transactions)**.

```mermaid
graph LR
    subgraph User Environment
        A[MetaMask EOA]
        B[EIP-7702 Upgrade]
        C[EIP-7715 Permission]
        A -->|Grants| C
        A -.->|Stateless| B
    end

    subgraph Agent Backend
        D[AI Intent Parser]
        E[1Shot Estimate]
        F[1Shot Send]
        C --> D
        D -->|Validates intent| E
        E -->|Locks gas price| F
    end

    subgraph 1Shot Relayer
        G[Pay gas in ETH]
        H[Redeem Delegation]
        I[Execute Transfer]
        F --> G
        G --> H
        H --> I
    end

    style A fill:#E2761B,stroke:#fff,stroke-width:2px,color:#fff
    style C fill:#E2761B,stroke:#fff,stroke-width:2px,color:#fff
    style D fill:#125DA3,stroke:#fff,stroke-width:2px,color:#fff
    style E fill:#239aaa,stroke:#fff,stroke-width:2px,color:#fff
    style F fill:#239aaa,stroke:#fff,stroke-width:2px,color:#fff
    style H fill:#239aaa,stroke:#fff,stroke-width:2px,color:#fff
    style I fill:#10b981,stroke:#fff,stroke-width:2px,color:#fff
```

- **How it works:** 
  1. The backend uses `relayer_estimate7710Transaction` to dynamically calculate the fee in USDC.
  2. The backend batches the *Fee Transfer* and the *User's Target Transfer* together.
  3. It sends this batch to `relayer_send7710Transaction` along with the EIP-7715 permission context.
  4. The 1Shot Relayer pays the ETH gas fee on-chain, executes `Redeem Delegations`, takes its USDC fee, and executes the user's intent.

---

## 🛠 How It Works

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Frontend (Vite + React)
    participant API as Backend Agent (Express)
    participant Venice as Venice AI
    participant MM as MetaMask (ERC-7715)
    participant Relay as 1Shot Relayer (ERC-7710)
    participant Chain as On-Chain (Base Sepolia / Monad)

    User->>UI: Type goal in plain English
    UI->>Venice: POST /chat/completions - parse intent
    Venice-->>UI: Structured intent JSON
    UI->>User: Show Confirmation Card
    User->>MM: Grant scoped permission (wallet_requestExecutionPermissions)
    MM-->>UI: Delegation context
    UI->>API: Execute intent + delegation
    API->>Relay: relayer_estimate7710Transaction
    Relay-->>API: Required fee + context
    API->>Relay: relayer_send7710Transaction (gasless)
    Relay-->>Chain: Execute on-chain action
    Relay->>API: Webhook - confirmed
```

---

## 🌐 Supported Networks

| Network | Chain ID | Status | 1Shot Support |
|---|---|---|---|
| Base Sepolia | 84532 | Active | Full Support |
| Monad Testnet | 10143 | Soon | - |

---

## 🚀 Quick Start

### Prerequisites
- Node.js >= 24
- MetaMask browser extension
- Venice AI API key
- 1Shot API account

### Installation
```bash
git clone https://github.com/JaDi03/GlassVault.git
cd GlassVault
npm install
cp .env.example .env
npm run dev
```

---

## 📁 Project Structure

```text
glassvault/
├── apps/
│   ├── web/                   - Vite + React frontend (UI, EIP-7715)
│   └── api/                   - Node.js Express backend (1Shot Relayer, AI)
├── packages/
│   └── shared/                - Shared TypeScript types
```

## 📄 License
[MIT](./LICENSE) - Copyright (c) 2026 GlassVault
