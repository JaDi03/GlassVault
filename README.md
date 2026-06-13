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

GlassVault is not just an AI interface; it is a **secure Multi-Agent orchestration engine** built on top of the [MetaMask Smart Accounts Kit](https://github.com/MetaMask/smart-accounts). To protect users against one of the biggest threats to Web3 AI (Prompt Injection), we implemented **Granular Transitive Permissions (EIP-7710/EIP-7715 Redelegation)**.

Instead of granting blanket execution permissions to a single agent, GlassVault utilizes a strict Just-In-Time (JIT) redelegation chain:

1. **EIP-7702 & EIP-7715 (User -> Chat Agent):** The user's standard EOA is dynamically wrapped into a `Stateless7702` virtual smart account. The user signs a periodic allowance (e.g., $50 USDC/day) granting restricted access to the **Chat Agent**.
2. **JIT Redelegation (Chat Agent -> Security Agent):** The Chat Agent parses the intent. Instead of executing, it dynamically *redelegates* the exact requested amount (Transfer + Relayer Fee) to the **Security Agent**.
3. **Security Firewall:** The Security Agent acts as an isolated firewall. It evaluates the prompt using heuristics and a secondary LLM to detect Prompt Injection attacks. If malicious, the redelegation is destroyed.
4. **Final Redelegation (Security Agent -> 1Shot Relayer):** If validated as safe, the Security Agent *redelegates* that exact sub-budget to the 1Shot Relayer.
5. **Gasless Execution:** The 1Shot API executes the final transaction on-chain, paying gas in USDC on behalf of the user.

#### Orchestration Workflow

```mermaid
sequenceDiagram
    participant User as User (MetaMask)
    participant ChatAgent as Chat Agent (Parser)
    participant SecAgent as Security Agent (Firewall)
    participant Relayer as 1Shot Relayer (Executor)

    Note over User,ChatAgent: 1. Global Budget (EIP-7715)
    User->>ChatAgent: Delegates 50 USDC/day
    
    Note over ChatAgent: Prompt Injection Attempt
    
    Note over ChatAgent,SecAgent: 2. JIT Redelegation Attempt
    ChatAgent->>SecAgent: Redelegation (e.g. 50 USDC to 0xAttacker)
    
    Note over SecAgent: 3. HYBRID VALIDATION
    SecAgent-->>SecAgent: Level 1: Heuristic Filter
    SecAgent-->>SecAgent: Level 2: LLM Auditor ("Is this an attack?")
    
    alt Is Malicious (Prompt Injection)
        SecAgent--xUser: REJECTED: Destroys redelegation
    else Is Safe
        Note over SecAgent,Relayer: 4. Final JIT Authorization
        SecAgent->>Relayer: Security Redelegation -> 1Shot
        Relayer->>Blockchain: Gasless On-Chain Execution
    end
```

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
    participant Chain as On-Chain (Base Sepolia)

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
