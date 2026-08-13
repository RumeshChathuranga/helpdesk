# AI-Powered Ticket Management System

## Problem

We recieve hundreds of support emails daily. Our agents manually read, classify, and respond to each ticket - which is slow and leads to impersonal, canned responses

## Solution

Build a ticket management system that uses AI to automatically classify, respond to and route support tickets - delivering faster, more personlized responses to students while freeing up agents for complex issues

## Ticket Statuses

Tickets progress through the following statuses:

- **Open** — Ticket has been received and is awaiting agent action
- **Resolved** — Agent has responded and considers the issue addressed
- **Closed** — Ticket is fully closed and no further action is needed

## Ticket Categories

Each ticket belongs to exactly one of the following categories:

- **General Question** — General inquiries not fitting other categories
- **Technical Question** — Issues related to technical problems or platform usage
- **Refund Question** — Requests or queries related to refunds or billing

## User Roles

- **Admin** — Deployed with the system. Can create and manage agent accounts, and has full access to all system features.
- **Agent** — Created by an admin. Can view, manage, and respond to tickets.

## Features

- Receive support emails and create tickets
- Auto-generate human-friendly responses using a knowledge base
- Ticket list with filtering and sorting
- Ticket detail view
- AI-powered ticket classification (into defined categories)
- AI summaries
- AI-suggested replies
- User management (admin only — create and manage agents)
- Dashboard to view and manage all tickets
