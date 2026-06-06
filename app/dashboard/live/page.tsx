'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Mic, MicOff, PhoneOff, X } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Status    = 'ready' | 'listening' | 'ended' | 'error'
type Speaker   = 'agent' | 'prospect'
type CallFocus =
  | 'mortgage_protection'
  | 'term_life'
  | 'final_expense'
  | 'iul'
  | 'medicare_supplement'
  | 'medicare_advantage'
  | 'annuities'

interface ObjEntry {
  triggers: string[]
  label:    string
  response: string
  nextMove: string
}
interface TranscriptLine {
  id: string; text: string; time: string; speaker: Speaker; isKeyMoment: boolean
}
interface DetectedObjection {
  id: string; label: string; trigger: string; response: string; nextMove: string; quote: string; time: string
}

// ─── Focus metadata ───────────────────────────────────────────────────────────

const FOCUS_OPTIONS: { value: CallFocus; label: string }[] = [
  { value: 'mortgage_protection',  label: 'Mortgage Protection' },
  { value: 'term_life',            label: 'Term Life' },
  { value: 'final_expense',        label: 'Final Expense / Burial' },
  { value: 'iul',                  label: 'IUL (Indexed Universal Life)' },
  { value: 'medicare_supplement',  label: 'Medicare Supplement' },
  { value: 'medicare_advantage',   label: 'Medicare Advantage' },
  { value: 'annuities',            label: 'Annuities' },
]

const FOCUS_BADGE: Record<CallFocus, string> = {
  mortgage_protection: 'MORT PROTECT',
  term_life:           'TERM LIFE',
  final_expense:       'FINAL EXPENSE',
  iul:                 'IUL',
  medicare_supplement: 'MED SUPP',
  medicare_advantage:  'MED ADVANTAGE',
  annuities:           'ANNUITIES',
}

// ─── Objection library (per product) ─────────────────────────────────────────

const PRODUCT_OBJECTIONS: Record<CallFocus, ObjEntry[]> = {

  mortgage_protection: [
    {
      triggers: ['no idea what you', "don't know what you're talking about", 'what is this', 'what are you talking about'],
      label: 'Confusion',
      response: "That's completely fair — I should have been clearer. I'm calling about the mortgage protection benefit tied to your home at [address]. It's a government-backed program. Did you know this was available to you?",
      nextMove: "Re-establish what you're calling about in one sentence. Get a yes/no.",
    },
    {
      triggers: ['i got to go', 'i have to go', "i'm busy", 'bad time', 'call me back', 'not a good time', 'call back later', 'not right now', 'busy right now'],
      label: 'Time Objection',
      response: "I completely understand — I only need 90 seconds. The reason I'm calling is there's a benefit tied specifically to your home that most homeowners never claim. Can I get just 90 seconds?",
      nextMove: "Ask for 90 seconds specifically. Never ask for \"a few minutes.\"",
    },
    {
      triggers: ['leave me alone', 'lose my number', 'stop calling', "don't call again", 'remove me'],
      label: 'Strong Rejection',
      response: "I hear you and I will absolutely respect that. Before I go — the only reason I called is there's a death benefit tied to your mortgage that pays off your home if something happens to you. I just want to make sure your family knows it exists. That's it.",
      nextMove: "Plant the seed and exit gracefully. Do not push further.",
    },
    {
      triggers: ['not interested', "don't want it", "don't need it", "i'm good", "we're fine", 'no thanks', 'not for me'],
      label: 'Not Interested',
      response: "I hear you. Most people I talk to say the same thing before they understand what this actually is. Can I ask — who in your life would be most financially impacted if you weren't around? That's really what this comes down to.",
      nextMove: "Find the emotional why. Make it about people, not product.",
    },
    {
      triggers: ['already have life insurance', 'already have a policy', 'have coverage through work', 'already have coverage', 'already covered'],
      label: 'Already Covered',
      response: "That's great — most employer plans only cover 1–2x your salary. If you passed away tonight, how long would that last your family? This is specifically designed to cover what your current policy doesn't.",
      nextMove: "Gap sell. Find out their current coverage amount vs what they actually need.",
    },
    {
      triggers: ['too expensive', "can't afford it", 'cannot afford', 'how much does it cost', "what's the price", 'how much is it', 'costs too much'],
      label: 'Price Objection',
      response: "Most people I talk to spend less than $1 a day on this. But before we even get to price — can I ask what it would mean to your family if your home was paid off if something happened to you?",
      nextMove: "Anchor to value before revealing price. Always.",
    },
    {
      triggers: ['need to think about it', 'let me think', "i'll think about it", 'need to talk to my spouse', 'talk to my wife', 'talk to my husband', 'check with my partner'],
      label: 'Stall Objection',
      response: "That makes complete sense — this is an important decision. What specifically would you need to think through? Is it the cost, the coverage, or something else?",
      nextMove: "Isolate the real objection. \"Think about it\" always means something else.",
    },
    {
      triggers: ['why do you sound like ai', 'are you a robot', 'is this automated', 'is this a recording'],
      label: 'Trust / Authenticity',
      response: "Ha — I get that a lot, I appreciate you saying that. I'm a real person, my name is [name]. The reason I sound scripted is I talk to a lot of homeowners every day. What's your first name?",
      nextMove: "Get their name immediately. Personalize everything from here.",
    },
    {
      triggers: ["nobody it's just me", 'i live alone', 'no family', 'no kids', 'divorced', 'just me'],
      label: 'No Dependents',
      response: "I completely understand. Even if there's no family to protect right now, this also covers your estate — so your home doesn't go into probate or leave debt behind. Does that matter to you?",
      nextMove: "Shift from family protection to estate/debt protection angle.",
    },
  ],

  term_life: [
    {
      triggers: ['no idea what you', "don't know what you're talking about", 'what is this', 'what are you talking about'],
      label: 'Confusion',
      response: "Fair enough — let me be direct. I'm calling about term life insurance. It's pure income protection — if something happened to you, your family gets a tax-free lump sum to replace your income. Has anyone walked you through this before?",
      nextMove: "One sentence on what term life does. Confirm they understand before moving on.",
    },
    {
      triggers: ['i got to go', 'i have to go', "i'm busy", 'bad time', 'call me back', 'not a good time', 'call back later', 'not right now'],
      label: 'Time Objection',
      response: "I get it — I just have one quick question. If your income stopped tomorrow, how long could your family cover the mortgage and bills without it? That's the number this is built around. 90 seconds?",
      nextMove: "Ask for 90 seconds. Frame the one question they should think about.",
    },
    {
      triggers: ['leave me alone', 'lose my number', 'stop calling', "don't call again", 'remove me'],
      label: 'Strong Rejection',
      response: "Absolutely, I'll respect that. One thing before I go — the average 20-year term for a healthy person your age is less than $1/day. If that changes, the door is always open. Take care.",
      nextMove: "Plant the seed with the price point, then exit. No pressure.",
    },
    {
      triggers: ['not interested', "don't want it", "don't need it", "i'm good", "we're fine", 'no thanks'],
      label: 'Not Interested',
      response: "Most people say that — until they think about what happens to their family's income if they're gone. How long until your mortgage is paid off or your youngest is out of the house? That window is exactly what this covers.",
      nextMove: "Anchor to the specific time window they need to bridge. Make it concrete.",
    },
    {
      triggers: ['already have life insurance', 'already have a policy', 'have coverage through work', 'already have coverage'],
      label: 'Already Covered',
      response: "Most work policies are 1–2x salary and they disappear the day you leave that job. A 20-year term locks in your rate today and follows you anywhere. How much does your work policy actually pay out?",
      nextMove: "Find the gap. Get their current work coverage amount vs their real income replacement need.",
    },
    {
      triggers: ['too expensive', "can't afford it", 'how much does it cost', "what's the price", 'how much is it'],
      label: 'Price Objection',
      response: "A 20-year, $500k term policy for a healthy person your age is typically $25–$40/month. That's income replacement for 20 years. What would your family's monthly expenses look like if your income was gone?",
      nextMove: "Give a real number. Anchor to what it costs NOT to have it.",
    },
    {
      triggers: ['need to think about it', 'let me think', "i'll think about it", 'need to talk to my spouse', 'talk to my wife', 'talk to my husband'],
      label: 'Stall Objection',
      response: "Completely fair — what specifically do you need to think through? Is it whether you need more than what work provides, or something about the cost?",
      nextMove: "Narrow it to one question. \"Think about it\" always hides a specific blocker.",
    },
    {
      triggers: ['why do you sound like ai', 'are you a robot', 'is this automated', 'is this a recording'],
      label: 'Trust / Authenticity',
      response: "Ha — totally fair, I appreciate you asking. Real person here. I talk to a lot of families every day, which is why I sound polished. What's your first name?",
      nextMove: "Get their name. Everything personalizes from here.",
    },
  ],

  final_expense: [
    {
      triggers: ['no idea what you', "don't know what you're talking about", 'what is this', 'what are you talking about'],
      label: 'Confusion',
      response: "Let me explain — I'm calling about final expense coverage. It's a small whole life policy designed specifically to cover funeral and burial costs so your family doesn't have to come out of pocket. The average funeral today is $12,000–$15,000. Were you aware of this option?",
      nextMove: "One sentence. Ask if they knew it existed. Most don't.",
    },
    {
      triggers: ['i got to go', 'i have to go', "i'm busy", 'bad time', 'call me back', 'not a good time', 'not right now'],
      label: 'Time Objection',
      response: "I understand — I just need 60 seconds. The average funeral costs $12,000–$15,000. Most families have to go into debt or crowdfund to cover it. I just want to make sure that burden doesn't land on yours. Can I get 60 seconds?",
      nextMove: "Lead with the $12,000–$15,000 number. That's the hook.",
    },
    {
      triggers: ['leave me alone', 'lose my number', 'stop calling', "don't call again", 'remove me'],
      label: 'Strong Rejection',
      response: "I hear you — I'll respect that. One thing before I go: the average funeral is $12,000–$15,000. This program makes sure your family doesn't carry that. Rates start under $50/month and are locked in forever. Just wanted you to know it exists.",
      nextMove: "Leave them with the two numbers: $12,000 cost and <$50/month solution. Exit.",
    },
    {
      triggers: ['not interested', "don't want it", "don't need it", "i'm good", "we're fine", 'no thanks'],
      label: 'Not Interested',
      response: "I understand. Nobody likes thinking about this. But think about the people who love you — when you're gone, someone has to make those arrangements and pay for them. This makes sure that doesn't become their burden. Does that matter to you?",
      nextMove: "Make it about not burdening the people who care about them. That's the emotional close.",
    },
    {
      triggers: ['already have life insurance', 'already have a policy', 'already have coverage'],
      label: 'Already Covered',
      response: "That's great — does your current policy specifically name funeral and burial costs? Most life insurance is structured for income replacement, not final expenses. This fills that specific gap so your family isn't dipping into the life insurance just to cover the funeral.",
      nextMove: "Ask them to confirm their policy covers funeral costs specifically. Most don't.",
    },
    {
      triggers: ['too expensive', "can't afford it", 'how much does it cost', "what's the price", 'how much is it'],
      label: 'Price Objection',
      response: "Most plans run $40–$80 a month depending on age — and that rate is locked in forever, it never goes up. Would you rather know that cost is handled, or leave a $12,000–$15,000 bill for your family to figure out?",
      nextMove: "Rate-never-goes-up is the close. Contrast the monthly premium against the funeral cost.",
    },
    {
      triggers: ['health', 'sick', 'medical condition', 'pre-existing', 'diabetes', 'heart', 'cancer', 'denied before'],
      label: 'Health Concern',
      response: "This is guaranteed issue — no medical exam, no health questions. If you're between 50 and 85, you qualify. Period. Health doesn't matter here.",
      nextMove: "Remove the health barrier entirely. They already qualify. Move to cost.",
    },
    {
      triggers: ["nobody it's just me", 'i live alone', 'no family', 'no kids', 'divorced', 'just me'],
      label: 'No Dependents',
      response: "Even without close family, someone will be responsible for your arrangements — a sibling, a friend, or in the worst case, the state decides. This ensures the people who care about you don't carry that weight or make those decisions under financial pressure.",
      nextMove: "Shift from protecting family to not burdening anyone who cares about them.",
    },
    {
      triggers: ['need to think about it', 'let me think', "i'll think about it", 'need to talk to my spouse', 'talk to my wife'],
      label: 'Stall Objection',
      response: "Of course — what specifically do you need to think about? Is it the monthly cost, or whether you already have something that covers this?",
      nextMove: "Isolate what's actually holding them back. The stall usually hides a coverage question.",
    },
  ],

  iul: [
    {
      triggers: ['no idea what you', "don't know what you're talking about", 'what is this', 'what are you talking about'],
      label: 'Confusion',
      response: "Fair — IUL stands for Indexed Universal Life. In plain terms: it's a life insurance policy that's overfunded to build tax-free cash value tied to a market index. When the market goes up, you earn. When it drops, you can't lose principal. Were you aware this could be used as a tax-free retirement vehicle?",
      nextMove: "Confirm they understand the floor/cap concept before going further.",
    },
    {
      triggers: ['i got to go', 'i have to go', "i'm busy", 'bad time', 'call me back', 'not a good time', 'not right now'],
      label: 'Time Objection',
      response: "Understood — quick question before you go: are you currently putting money into a 401k or IRA? If so, every dollar you withdraw in retirement is fully taxable. The IUL is how people solve that. Worth 90 seconds?",
      nextMove: "Frame the 401k tax problem as the hook. That gets attention.",
    },
    {
      triggers: ['not interested', "don't want it", "don't need it", "i'm good", "we're fine", 'no thanks'],
      label: 'Not Interested',
      response: "Completely understand. Most people I talk to are putting money into a 401k that's fully taxable on withdrawal. An IUL gives you the same tax-free growth as a Roth but with no contribution limits and zero market risk on the downside. Would you be open to a 5-minute comparison?",
      nextMove: "Compare to what they already know. 401k vs IUL is the frame that lands.",
    },
    {
      triggers: ['already have life insurance', 'already have a policy', 'already investing', 'have a 401k', 'have a roth'],
      label: 'Already Covered',
      response: "This isn't competing with your 401k or existing policy — it's the layer high earners add once they've maxed those out. The question is: do you want some of your retirement income to be 100% tax-free regardless of what tax rates look like in 20 years?",
      nextMove: "Position it as an additional layer, not a replacement. Tax-free in retirement is the angle.",
    },
    {
      triggers: ['too expensive', "can't afford it", 'how much does it cost', "what's the price", 'how much is it'],
      label: 'Price Objection',
      response: "The money going in isn't a cost — you're redirecting dollars you already have into an asset that grows tax-free and builds cash value. What are you currently putting aside for retirement each month?",
      nextMove: "Reframe premium as redirection of savings, not an expense. Find their monthly savings number.",
    },
    {
      triggers: ['risky', 'sounds complicated', "i don't understand", 'confusing', 'sounds too good', 'what is the catch'],
      label: 'Skepticism',
      response: "The concept is simple: your cash value is linked to an index like the S&P 500. When it goes up, you get credited. When it goes down, your floor is zero — you never lose principal. The 'catch' is surrender periods and fees, which I'll walk you through completely. No surprises.",
      nextMove: "Address the floor/cap concept with a concrete example. Transparency builds trust here.",
    },
    {
      triggers: ['need to think about it', 'let me think', 'need to talk to my spouse', 'talk to my wife', 'talk to my husband'],
      label: 'Stall Objection',
      response: "Makes sense — what part would you need to think through? Is it how the tax-free piece works, or how it compares to what you're already doing for retirement?",
      nextMove: "Narrow it to the specific concept that's unclear. Offer an illustration.",
    },
    {
      triggers: ['why do you sound like ai', 'are you a robot', 'is this automated', 'is this a recording'],
      label: 'Trust / Authenticity',
      response: "Ha — fair question. Real person here, I promise. I talk to a lot of people every day about retirement strategy, which is why I sound polished. What's your first name — I want to make this specific to your situation.",
      nextMove: "Get their name. Personalize immediately.",
    },
  ],

  medicare_supplement: [
    {
      triggers: ['no idea what you', "don't know what you're talking about", 'what is this', 'what are you talking about'],
      label: 'Confusion',
      response: "Let me be clear — a Medicare Supplement, or Medigap, covers the 20% that Medicare Part B doesn't pay. Most people don't realize Medicare has gaps until they get a bill. Do you currently have anything covering that remaining 20%?",
      nextMove: "Ask directly if they have gap coverage. Most don't know they need it.",
    },
    {
      triggers: ['i got to go', 'i have to go', "i'm busy", 'bad time', 'call me back', 'not a good time', 'not right now'],
      label: 'Time Objection',
      response: "I get it — 60 seconds. Medicare alone can leave you with thousands in out-of-pocket costs in a bad year. A Supplement caps that exposure completely. Is that something worth a 60-second conversation?",
      nextMove: "Lead with out-of-pocket risk. The deductible alone is over $1,600.",
    },
    {
      triggers: ['leave me alone', 'lose my number', 'stop calling', "don't call again", 'remove me'],
      label: 'Strong Rejection',
      response: "Absolutely, I'll respect that. One thing before I go: Medicare's Part B deductible alone is over $1,600 this year and can leave unlimited 20% gaps. A Supplement eliminates that risk. If that ever becomes relevant, feel free to reach out.",
      nextMove: "Leave them with the $1,600 deductible fact. Exit gracefully.",
    },
    {
      triggers: ['not interested', "don't want it", "don't need it", "i'm good", "we're fine", 'no thanks'],
      label: 'Not Interested',
      response: "I understand. Most people on just Medicare feel fine — until they have a hospital stay or a specialist visit and get a bill for thousands in the 20% Medicare didn't cover. A Supplement gives you one predictable monthly cost instead of surprise bills. Does predictability matter to you?",
      nextMove: "Anchor to the unpredictability of co-insurance. One bad year can cost tens of thousands.",
    },
    {
      triggers: ['already have a supplement', 'already have coverage', 'have a medigap', 'already have a plan'],
      label: 'Already Covered',
      response: "What plan are you on? Plans change every year and many people are overpaying for the same coverage. I may be able to get you identical benefits at a lower monthly rate. Would a 5-minute comparison be worth it?",
      nextMove: "Offer a rate comparison. Most people with Supplements are overpaying — that's the hook.",
    },
    {
      triggers: ['too expensive', "can't afford it", 'how much does it cost', "what's the price", 'how much is it'],
      label: 'Price Objection',
      response: "Supplements typically run $100–$180/month. Compare that to one hospital stay where just the deductible is over $1,600 — and that's before the 20% co-insurance. Which feels more manageable: a predictable $100/month or unpredictable thousands when something happens?",
      nextMove: "Contrast the monthly premium against one concrete out-of-pocket scenario.",
    },
    {
      triggers: ['my doctor', 'in network', 'network', 'specialist', 'keep my doctor'],
      label: 'Doctor Network Concern',
      response: "That's actually the biggest advantage of a Supplement over Advantage — with a Supplement, you can see any doctor in the country who accepts Medicare. No network, no referrals, no prior authorizations.",
      nextMove: "Emphasize freedom: any doctor, anywhere, no network restrictions. That's the win.",
    },
    {
      triggers: ['need to think about it', 'let me think', 'need to talk to my spouse', 'talk to my wife'],
      label: 'Stall Objection',
      response: "Of course. What specifically do you need to look into — is it comparing what you have now, or making sure your doctors are covered?",
      nextMove: "Narrow to one specific question holding them back. Offer to answer it right now.",
    },
  ],

  medicare_advantage: [
    {
      triggers: ['no idea what you', "don't know what you're talking about", 'what is this', 'what are you talking about'],
      label: 'Confusion',
      response: "Medicare Advantage is an all-in-one plan that replaces original Medicare and typically includes dental, vision, hearing — and often has a $0 premium. Most people switching from original Medicare are surprised by the extra benefits. Are you currently on original Medicare Parts A and B?",
      nextMove: "Confirm they're on original Medicare first. That's the eligibility question.",
    },
    {
      triggers: ['i got to go', 'i have to go', "i'm busy", 'bad time', 'call me back', 'not a good time', 'not right now'],
      label: 'Time Objection',
      response: "Understood. Quick question: does your current plan include dental and vision? Most original Medicare doesn't. Many Advantage plans in your area cover both at $0 premium. Worth 60 seconds?",
      nextMove: "Lead with the dental/vision gap in original Medicare. That usually gets attention.",
    },
    {
      triggers: ['leave me alone', 'lose my number', 'stop calling', "don't call again", 'remove me'],
      label: 'Strong Rejection',
      response: "I hear you, I'll respect that. Quick note: Medicare Advantage plans change every year, and new options come in for open enrollment. If you're on original Medicare, plans with $0 premium and dental/vision are available in most areas. Just want you to know the option exists.",
      nextMove: "Leave them with $0 premium and open enrollment. Exit cleanly.",
    },
    {
      triggers: ['not interested', "don't want it", "don't need it", "i'm good", "we're fine", 'no thanks'],
      label: 'Not Interested',
      response: "Totally fair — most people don't know what they're missing until we do a side-by-side. Many plans in your area have $0 premiums and include dental, vision, and hearing that Medicare doesn't cover at all. Would it hurt to just see what's available?",
      nextMove: "Zero-pressure side-by-side comparison. The $0 premium usually opens the door.",
    },
    {
      triggers: ['already have a plan', 'already have coverage', 'have an advantage plan', 'already enrolled'],
      label: 'Already Covered',
      response: "What plan are you on? Plans change benefits and star ratings every year, and new options come into your area. We can do a quick comparison for this year's enrollment to make sure you have the best available. Takes about 5 minutes.",
      nextMove: "Annual plan comparison is the annual hook. Every year is a fresh conversation.",
    },
    {
      triggers: ['too expensive', "can't afford it", 'how much does it cost', "what's the price", 'how much is it'],
      label: 'Price Objection',
      response: "Many plans in your area are $0 monthly premium. The real cost question for Advantage is copays when you use it. What did you pay out of pocket for medical last year? I can show you plans that may cost less overall.",
      nextMove: "Shift from premium to total out-of-pocket. Calculate their annual cost comparison.",
    },
    {
      triggers: ['my doctor', 'keep my doctor', 'same doctors', 'network', 'specialist', 'in network'],
      label: 'Doctor Network Concern',
      response: "That's the right first question. Tell me your primary doctor's name and I'll check which plans include them before we go any further. No point looking at plans your doctor isn't in.",
      nextMove: "Check their doctor first. If they're in-network, it's a much easier close.",
    },
    {
      triggers: ['need to think about it', 'let me think', 'need to talk to my spouse', 'talk to my wife'],
      label: 'Stall Objection',
      response: "Makes sense — what would you need to feel confident? Is it confirming your doctors are covered, or understanding what the plan costs when you actually use it?",
      nextMove: "One specific question is holding them back. Surface it and answer it now.",
    },
  ],

  annuities: [
    {
      triggers: ['no idea what you', "don't know what you're talking about", 'what is this', 'what are you talking about'],
      label: 'Confusion',
      response: "Fair — an annuity is a contract where you move a lump sum, usually from savings or a 401k rollover, and it grows at a guaranteed rate. When you're ready, it converts to guaranteed income you can't outlive. The core idea: protect principal and create income. Does that make sense as a starting point?",
      nextMove: "Confirm understanding before going further. Most people confuse annuities with something complex.",
    },
    {
      triggers: ['i got to go', 'i have to go', "i'm busy", 'bad time', 'call me back', 'not a good time', 'not right now'],
      label: 'Time Objection',
      response: "I'll be quick — two questions. One: are you worried about outliving your money? Two: what are your savings earning right now? Fixed annuity rates are at 5–6% guaranteed. If either of those matters, it's worth 90 seconds.",
      nextMove: "Lead with the two fears: running out of money, and low savings rates.",
    },
    {
      triggers: ['leave me alone', 'lose my number', 'stop calling', "don't call again", 'remove me'],
      label: 'Strong Rejection',
      response: "Absolutely, I'll respect that. One thing: if your savings are sitting in CDs or a savings account earning under 2%, fixed annuity rates are at 5–6% with the same principal protection. If rates drop again, it's worth knowing the option exists.",
      nextMove: "Leave them with the rate comparison. Seed only, then exit.",
    },
    {
      triggers: ['not interested', "don't want it", "don't need it", "i'm good", "we're fine", 'no thanks'],
      label: 'Not Interested',
      response: "Understood. Most people I talk to have two retirement fears: running out of money and losing principal in a market crash. An annuity solves both. Which one concerns you more right now?",
      nextMove: "Find their primary fear: longevity risk or market risk. That determines your angle.",
    },
    {
      triggers: ['already have savings', 'have a 401k', 'have investments', 'already set', 'financial advisor'],
      label: 'Already Covered',
      response: "Great. What are you currently earning on your savings or CDs? Fixed annuity rates right now are 5–6%, guaranteed, with principal protection similar to FDIC. If you're earning less than that, we should talk about it.",
      nextMove: "Rate comparison wins immediately if they're in low-yield savings. Get their current rate.",
    },
    {
      triggers: ['too expensive', "can't afford it", 'how much does it cost', "what's the price", 'how much is it'],
      label: 'Price Objection',
      response: "You're not spending money — you're moving money you already have to a place where it earns more and is protected. What are you currently doing with your savings? I want to show you a straight comparison.",
      nextMove: "This isn't a cost — it's repositioning existing assets. Get their current savings amount.",
    },
    {
      triggers: ['market', 'stocks', 'lose money', 'crash', 'recession', 'risky', 'investment risk'],
      label: 'Market Risk Concern',
      response: "That's exactly why annuities exist. With a fixed or fixed-indexed annuity, you cannot lose principal due to market performance. The floor is zero — when the market crashes, you stay flat. You never go backwards.",
      nextMove: "Hard close on the principal protection guarantee. That's the reason most people buy.",
    },
    {
      triggers: ['need to think about it', 'let me think', "i'll think about it", 'need to talk to my spouse', 'talk to my wife'],
      label: 'Stall Objection',
      response: "Of course — what's the one thing you'd need to get comfortable? Is it the rate, the liquidity, or understanding how the income phase works?",
      nextMove: "Annuity stalls are usually about liquidity fear. Surface it and address surrender periods directly.",
    },
  ],
}

// ─── Shared coaching data ─────────────────────────────────────────────────────

const KEY_MOMENT_TRIGGERS = [
  'how much', 'what does it cost', 'tell me more', 'interested', 'sounds good',
  'how does it work', 'what are the benefits', 'what would i get', 'how long does it take',
]

const NEGATIVE_WORDS = [
  'annoying', 'not interested', 'over it', "don't want", 'no thanks', 'stop calling',
  'waste of time', 'ridiculous', 'never', 'forget it', 'leave me alone', 'hate',
]
const POSITIVE_WORDS = [
  'sounds good', 'tell me more', 'interested', 'absolutely', 'definitely', 'love that',
  'that makes sense', 'good point', 'helpful', 'appreciate', 'excited', 'yes', 'great',
]

const PHASES = ['Opener', 'Discovery', 'Presentation', 'Objection Handling', 'Close']
const PHASE_CLOSE_KWORDS    = ['get started', 'sign up', "let's do it", 'move forward', 'enroll', 'how do i start']
const PHASE_PRESENT_KWORDS  = ['coverage', 'plan', 'policy', 'benefit', 'premium', 'protect', 'payout', 'term']
const PHASE_DISCOVER_KWORDS = ['family', 'kids', 'income', 'job', 'health', 'currently', 'situation', 'how many']

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

function computePhase(elapsed: number, lines: TranscriptLine[], objCount: number): number {
  const text = lines.map(l => l.text.toLowerCase()).join(' ')
  if (PHASE_CLOSE_KWORDS.some(k => text.includes(k))) return 4
  if (objCount > 0) return 3
  if (elapsed > 180 || PHASE_PRESENT_KWORDS.some(k => text.includes(k))) return 2
  if (elapsed > 60  || PHASE_DISCOVER_KWORDS.some(k => text.includes(k))) return 1
  return 0
}

function computeSentiment(score: number): { label: string; color: string; pct: number } {
  if (score > 1)  return { label: 'Positive', color: '#4A7C59', pct: Math.min(100, 60 + score * 12) }
  if (score < -1) return { label: 'Negative', color: '#C0392B', pct: Math.max(0,  40 + score * 12) }
  return { label: 'Neutral', color: '#8C6D2F', pct: 50 }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LiveCallPage() {
  const [status,          setStatus]          = useState<Status>('ready')
  const [callFocus,       setCallFocus]       = useState<CallFocus>('mortgage_protection')
  const [lines,           setLines]           = useState<TranscriptLine[]>([])
  const [interim,         setInterim]         = useState('')
  const [speaker,         setSpeaker]         = useState<Speaker>('agent')
  const [objections,      setObjections]      = useState<DetectedObjection[]>([])
  const [latestObjection, setLatestObjection] = useState<DetectedObjection | null>(null)
  const [elapsed,         setElapsed]         = useState(0)
  const [muted,           setMuted]           = useState(false)
  const [err,             setErr]             = useState('')
  const [showSummary,     setShowSummary]     = useState(false)
  const [score,           setScore]           = useState(7.0)
  const [sentimentScore,  setSentimentScore]  = useState(0)

  const recognitionRef   = useRef<any>(null)
  const statusRef        = useRef<Status>('ready')
  const speakerRef       = useRef<Speaker>('agent')
  const focusRef         = useRef<CallFocus>('mortgage_protection')
  const elapsedRef       = useRef(0)
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null)
  const scoreIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const flashRef         = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seenRef          = useRef(new Set<string>())
  const scrollRef        = useRef<HTMLDivElement>(null)
  const streamRef        = useRef<MediaStream | null>(null)
  const liveRef          = useRef({ lines: [] as TranscriptLine[], objCount: 0, sentimentScore: 0 })

  useEffect(() => {
    liveRef.current = { lines, objCount: objections.length, sentimentScore }
  }, [lines, objections, sentimentScore])

  useEffect(() => {
    const prospectLines = lines.filter(l => l.speaker === 'prospect').slice(-5)
    if (prospectLines.length === 0) return
    const text = prospectLines.map(l => l.text).join(' ').toLowerCase()
    let s = 0
    NEGATIVE_WORDS.forEach(w => { if (text.includes(w)) s -= 1 })
    POSITIVE_WORDS.forEach(w => { if (text.includes(w)) s += 1 })
    setSentimentScore(Math.max(-3, Math.min(3, s)))
  }, [lines])

  const setStatusSynced = useCallback((s: Status) => {
    statusRef.current = s; setStatus(s)
  }, [])

  const setSpeakerSynced = useCallback((s: Speaker) => {
    speakerRef.current = s; setSpeaker(s)
  }, [])

  // Changing focus mid-call resets seen objections so new product's angles can fire
  const setCallFocusSynced = useCallback((f: CallFocus) => {
    focusRef.current = f
    setCallFocus(f)
    seenRef.current.clear()
  }, [])

  const checkObjection = useCallback((text: string, time: string) => {
    const db = PRODUCT_OBJECTIONS[focusRef.current]
    const lower = text.toLowerCase()
    for (const entry of db) {
      const matched = entry.triggers.find(t => lower.includes(t))
      if (!matched || seenRef.current.has(entry.label)) continue
      seenRef.current.add(entry.label)
      const obj: DetectedObjection = {
        id: crypto.randomUUID(), label: entry.label, trigger: matched,
        response: entry.response, nextMove: entry.nextMove, quote: text, time,
      }
      setObjections(prev => [obj, ...prev])
      setLatestObjection(obj)
      if (flashRef.current) clearTimeout(flashRef.current)
      flashRef.current = setTimeout(() => setLatestObjection(null), 9000)
      break
    }
  }, [])

  const stopCall = useCallback((withSummary = true) => {
    if (timerRef.current)         { clearInterval(timerRef.current);         timerRef.current = null }
    if (scoreIntervalRef.current) { clearInterval(scoreIntervalRef.current); scoreIntervalRef.current = null }
    if (flashRef.current)         { clearTimeout(flashRef.current);          flashRef.current = null }
    try { recognitionRef.current?.stop() } catch {}
    recognitionRef.current = null
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setMuted(false); setInterim(''); setLatestObjection(null)
    setStatusSynced('ended')
    if (withSummary) setShowSummary(true)
  }, [setStatusSynced])

  const startCall = useCallback(async () => {
    if (typeof window === 'undefined') return
    setErr('')
    setStatusSynced('listening')
    setSpeakerSynced('agent')
    seenRef.current.clear()
    elapsedRef.current = 0
    setLines([]); setObjections([]); setInterim(''); setLatestObjection(null)
    setShowSummary(false); setElapsed(0); setMuted(false)
    setScore(7.0); setSentimentScore(0)

    try {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (!SR) throw new Error('no-support')

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        elapsedRef.current += 1
        setElapsed(elapsedRef.current)
      }, 1000)

      if (scoreIntervalRef.current) clearInterval(scoreIntervalRef.current)
      scoreIntervalRef.current = setInterval(() => {
        const { lines: ls, objCount, sentimentScore: sent } = liveRef.current
        const agentC    = ls.filter(l => l.speaker === 'agent').reduce((a, l) => a + l.text.length, 0)
        const prospectC = ls.filter(l => l.speaker === 'prospect').reduce((a, l) => a + l.text.length, 0)
        const total     = agentC + prospectC || 1
        const prospPct  = prospectC / total
        const kmCount   = ls.filter(l => l.isKeyMoment).length
        let s = 7.0
        s += Math.min(objCount * 0.25, 1.0)
        if (elapsedRef.current > 180) s += 0.3
        if (elapsedRef.current > 300) s += 0.2
        if (total > 80) {
          if (prospPct >= 0.38 && prospPct <= 0.72) s += 0.3
          else if (prospPct < 0.25) s -= 0.5
        }
        if (sent < -1) s -= 0.5
        else if (sent > 1) s += 0.2
        s += Math.min(kmCount * 0.15, 0.45)
        setScore(Math.max(0, Math.min(10, Math.round(s * 10) / 10)))
      }, 15000)

      const recognition = new SR()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onresult = (event: any) => {
        const time = fmt(elapsedRef.current)
        const currentSpeaker = speakerRef.current
        let newInterim = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            const text = transcript.trim()
            if (!text) continue
            const lower = text.toLowerCase()
            const isKeyMoment = currentSpeaker === 'prospect' &&
              KEY_MOMENT_TRIGGERS.some(k => lower.includes(k))
            setLines(prev => [...prev, { id: crypto.randomUUID(), text, time, speaker: currentSpeaker, isKeyMoment }])
            if (currentSpeaker === 'prospect') checkObjection(text, time)
            setTimeout(() => {
              if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
            }, 50)
          } else {
            newInterim += transcript
          }
        }
        setInterim(newInterim)
      }

      recognition.onerror = (event: any) => {
        if (event.error === 'aborted' || event.error === 'no-speech') return
        if (event.error === 'not-allowed') {
          setErr('Microphone access denied. Allow microphone access in your browser settings.')
          stopCall(false); setStatusSynced('error')
        } else {
          console.warn('[SpeechRecognition] error:', event.error)
        }
      }

      recognition.onend = () => {
        if (statusRef.current === 'listening') {
          try { recognition.start() } catch {}
        }
      }

      recognition.start()
      recognitionRef.current = recognition
    } catch (e: any) {
      if (e.message === 'no-support') {
        setErr('Speech recognition is not supported in this browser. Please use Google Chrome.')
      } else if (e.name === 'NotAllowedError' || (e.message ?? '').toLowerCase().includes('denied')) {
        setErr('Microphone access denied. Allow microphone access and try again.')
      } else {
        setErr(e.message || 'Failed to start. Check microphone permissions and try again.')
      }
      setStatusSynced('error')
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
      if (timerRef.current)         { clearInterval(timerRef.current);         timerRef.current = null }
      if (scoreIntervalRef.current) { clearInterval(scoreIntervalRef.current); scoreIntervalRef.current = null }
    }
  }, [checkObjection, stopCall, setStatusSynced, setSpeakerSynced])

  const endCall    = useCallback(() => stopCall(true), [stopCall])
  const toggleMute = useCallback(() => {
    if (!streamRef.current) return
    const next = !muted
    streamRef.current.getAudioTracks().forEach(t => { t.enabled = !next })
    setMuted(next)
  }, [muted])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (scoreIntervalRef.current) clearInterval(scoreIntervalRef.current)
      try { recognitionRef.current?.stop() } catch {}
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  // ─── Derived values ──────────────────────────────────────────────────────────

  const isLive = status === 'listening'

  const agentChars    = lines.filter(l => l.speaker === 'agent').reduce((a, l) => a + l.text.length, 0)
  const prospectChars = lines.filter(l => l.speaker === 'prospect').reduce((a, l) => a + l.text.length, 0)
  const talkTotal     = agentChars + prospectChars || 1
  const agentPct      = Math.round(agentChars / talkTotal * 100)
  const prospectPct   = 100 - agentPct

  const phase      = computePhase(elapsed, lines, objections.length)
  const sentiment  = computeSentiment(sentimentScore)
  const keyMoments = lines.filter(l => l.isKeyMoment)
  const scoreColor = score >= 7.5 ? '#4A7C59' : score >= 5.5 ? '#C9A84C' : '#C0392B'

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#F5F0E8', fontFamily: 'var(--font-space, system-ui, sans-serif)', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <header style={{ backgroundColor: '#1A2C1E', height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/dashboard" style={{ color: '#C8D9CB', display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none', fontSize: 12 }}>
            <ArrowLeft size={13} /> Dashboard
          </Link>
          <span style={{ color: '#4A7C59', opacity: 0.5 }}>|</span>
          <span style={{ color: '#C8D9CB', fontWeight: 700, fontSize: 14, letterSpacing: '0.06em' }}>SPEAR LIVE</span>
          {/* Focus badge — always visible */}
          <span style={{ padding: '3px 9px', borderRadius: 20, backgroundColor: 'rgba(74,124,89,0.2)', border: '1px solid rgba(74,124,89,0.4)', fontSize: 9, fontWeight: 800, color: '#4A7C59', letterSpacing: '0.09em' }}>
            {FOCUS_BADGE[callFocus]}
          </span>
          {isLive && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, backgroundColor: 'rgba(192,57,43,0.15)', border: '1px solid rgba(192,57,43,0.35)', fontSize: 10, fontWeight: 700, color: '#E07060', letterSpacing: '0.08em' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#E07060', animation: 'livePulse 1.4s ease-in-out infinite', display: 'inline-block' }} />
              LIVE
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isLive && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(200,217,203,0.55)' }}>SCORE</span>
              <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: scoreColor }}>{score.toFixed(1)}</span>
              <span style={{ fontSize: 9, color: 'rgba(200,217,203,0.4)' }}>/10</span>
            </div>
          )}
          {isLive && <span style={{ color: '#4A7C59', opacity: 0.4 }}>|</span>}
          {isLive && (
            <span style={{ color: '#C8D9CB', fontFamily: 'monospace', fontSize: 13 }}>{fmt(elapsed)}</span>
          )}
          {isLive && (
            <button onClick={toggleMute} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 7, backgroundColor: muted ? 'rgba(139,58,58,0.2)' : 'rgba(255,255,255,0.07)', border: `1px solid ${muted ? 'rgba(139,58,58,0.4)' : 'rgba(255,255,255,0.1)'}`, color: muted ? '#D08080' : '#C8D9CB', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
              {muted ? <MicOff size={12} /> : <Mic size={12} />}
              {muted ? 'Unmute' : 'Mute'}
            </button>
          )}
          {isLive && (
            <button onClick={endCall} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 13px', borderRadius: 7, backgroundColor: 'rgba(139,58,58,0.2)', border: '1px solid rgba(139,58,58,0.45)', color: '#D08080', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              <PhoneOff size={12} /> End Call
            </button>
          )}
        </div>
      </header>

      {/* ── Ready / Error state ── */}
      {!isLive && status !== 'ended' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ backgroundColor: '#FDFAF5', border: '1px solid #DDD5BB', borderRadius: 16, padding: '36px 32px', maxWidth: 480, width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: 'rgba(74,124,89,0.12)', border: '1px solid rgba(74,124,89,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Mic size={20} style={{ color: '#4A7C59' }} />
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1A', margin: '0 0 6px', textAlign: 'center' }}>Live Call Coaching</h2>
            <p style={{ fontSize: 13, color: '#7A7060', margin: '0 0 20px', lineHeight: 1.6, textAlign: 'center' }}>
              Select your product focus, then start the call. Spear will detect objections and surface the right response in real time.
            </p>

            {/* Product focus selector */}
            <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#7A7060' }}>CALL FOCUS</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 20 }}>
              {FOCUS_OPTIONS.map(opt => {
                const active = callFocus === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => setCallFocusSynced(opt.value)}
                    style={{ padding: '9px 12px', borderRadius: 8, border: `1px solid ${active ? '#4A7C59' : '#DDD5BB'}`, backgroundColor: active ? '#1A2C1E' : '#F5F0E8', color: active ? '#C8D9CB' : '#5A5448', fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.12s' }}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>

            {status === 'error' && err && (
              <div style={{ backgroundColor: 'rgba(192,57,43,0.07)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: 8, padding: '10px 14px', color: '#922B21', fontSize: 13, marginBottom: 14, lineHeight: 1.5 }}>
                {err}
              </div>
            )}
            <p style={{ fontSize: 11, color: '#9A9080', margin: '0 0 14px', textAlign: 'center' }}>
              Requires Google Chrome &nbsp;·&nbsp; Microphone access needed
            </p>
            <button
              onClick={startCall}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '13px 0', borderRadius: 10, backgroundColor: '#1A2C1E', color: '#C8D9CB', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}
            >
              <Mic size={15} /> Start Call
            </button>
          </div>
        </div>
      )}

      {/* ── Live panel ── */}
      {isLive && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Left: transcript */}
          <div style={{ flex: 3, display: 'flex', flexDirection: 'column', borderRight: '1px solid #DDD5BB', overflow: 'hidden' }}>

            {/* Phase bar */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', height: 34, backgroundColor: '#FDFAF5', borderBottom: '1px solid #DDD5BB', flexShrink: 0, gap: 2 }}>
              {PHASES.map((p, i) => (
                <div key={p} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <div style={{ flex: 1, textAlign: 'center', padding: '4px 2px', borderRadius: 4, backgroundColor: phase === i ? '#1A2C1E' : phase > i ? 'rgba(74,124,89,0.12)' : 'transparent', fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', color: phase === i ? '#C8D9CB' : phase > i ? '#4A7C59' : '#B8AFA0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p}
                  </div>
                  {i < 4 && <span style={{ fontSize: 9, color: '#CCC5B0', flexShrink: 0, margin: '0 1px' }}>›</span>}
                </div>
              ))}
            </div>

            {/* Focus selector (mid-call) */}
            <div style={{ padding: '6px 12px', backgroundColor: '#FDFAF5', borderBottom: '1px solid #DDD5BB', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.09em', color: '#9A9080', flexShrink: 0 }}>FOCUS</span>
              <select
                value={callFocus}
                onChange={e => setCallFocusSynced(e.target.value as CallFocus)}
                style={{ flex: 1, backgroundColor: '#EDE8DC', border: '1px solid #D4C9A8', borderRadius: 6, padding: '4px 8px', color: '#1C1C1A', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', outline: 'none' }}
              >
                {FOCUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Toggle row */}
            <div style={{ padding: '7px 12px', backgroundColor: '#FDFAF5', borderBottom: '1px solid #DDD5BB', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#7A7060' }}>TRANSCRIPT</span>
              <div style={{ display: 'flex', gap: 3, backgroundColor: '#EDE8DC', borderRadius: 8, padding: 3 }}>
                <button onClick={() => setSpeakerSynced('agent')} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', backgroundColor: speaker === 'agent' ? '#1A2C1E' : 'transparent', color: speaker === 'agent' ? '#C8D9CB' : '#7A7060' }}>
                  Agent
                </button>
                <button onClick={() => setSpeakerSynced('prospect')} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', backgroundColor: speaker === 'prospect' ? '#1A2C1E' : 'transparent', color: speaker === 'prospect' ? '#C8D9CB' : '#7A7060' }}>
                  Prospect
                </button>
              </div>
            </div>

            {/* Talk ratio */}
            {lines.length > 0 && (
              <div style={{ padding: '5px 12px 7px', backgroundColor: '#FDFAF5', borderBottom: '1px solid #DDD5BB', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#4A7C59' }}>YOU {agentPct}%</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#8C6D2F' }}>PROSPECT {prospectPct}%</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${agentPct}%`, backgroundColor: '#4A7C59', transition: 'width 0.5s ease' }} />
                  <div style={{ flex: 1, backgroundColor: '#8C6D2F' }} />
                </div>
              </div>
            )}

            {/* Lines */}
            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', backgroundColor: '#F5F0E8', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {lines.length === 0 && !interim ? (
                <p style={{ margin: 0, color: '#9A9080', fontSize: 13, fontStyle: 'italic' }}>
                  Listening… speak clearly and Spear will transcribe in real time.
                </p>
              ) : (
                <>
                  {lines.map(line => (
                    <div key={line.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 9, color: '#B0A898', fontFamily: 'monospace', flexShrink: 0, marginTop: 4 }}>{line.time}</span>
                      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.07em', flexShrink: 0, marginTop: 4, minWidth: 52, color: line.speaker === 'agent' ? '#4A7C59' : '#8C6D2F' }}>
                        {line.speaker === 'agent' ? 'YOU' : 'PROSPECT'}
                      </span>
                      {line.isKeyMoment && (
                        <span style={{ color: '#8C6D2F', fontSize: 11, flexShrink: 0, marginTop: 3 }} title="Key moment">✦</span>
                      )}
                      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: '#2C2A1E', flex: 1 }}>{line.text}</p>
                    </div>
                  ))}
                  {interim && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 9, color: '#B0A898', fontFamily: 'monospace', flexShrink: 0, marginTop: 4 }}>{fmt(elapsed)}</span>
                      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.07em', flexShrink: 0, marginTop: 4, minWidth: 52, color: speaker === 'agent' ? '#4A7C59' : '#8C6D2F' }}>
                        {speaker === 'agent' ? 'YOU' : 'PROSPECT'}
                      </span>
                      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: '#9A9080', fontStyle: 'italic', flex: 1 }}>
                        {interim}<span style={{ opacity: 0.4 }}>_</span>
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Objection flash */}
            {latestObjection && (
              <div style={{ margin: '0 12px 12px', padding: '12px 14px', borderRadius: 9, border: '1px solid rgba(192,57,43,0.25)', borderLeft: '3px solid #C0392B', backgroundColor: '#FFF5F4', flexShrink: 0, position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', color: '#C0392B', backgroundColor: 'rgba(192,57,43,0.1)', padding: '2px 8px', borderRadius: 4 }}>OBJECTION DETECTED</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1C1C1A' }}>{latestObjection.label}</span>
                </div>
                <p style={{ margin: '0 0 8px', fontSize: 12, color: '#7A7060', fontStyle: 'italic', lineHeight: 1.5 }}>&ldquo;{latestObjection.quote}&rdquo;</p>
                <div style={{ backgroundColor: '#FDFAF5', border: '1px solid #DDD5BB', borderRadius: 7, padding: '9px 11px', marginBottom: 7 }}>
                  <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', color: '#8C6D2F' }}>SUGGESTED RESPONSE</p>
                  <p style={{ margin: 0, fontSize: 12, color: '#2C2A1E', lineHeight: 1.6 }}>{latestObjection.response}</p>
                </div>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: '#4A7C59' }}>
                  NEXT MOVE &nbsp;<span style={{ fontWeight: 400, color: '#5A6A50', letterSpacing: 0 }}>{latestObjection.nextMove}</span>
                </p>
                <button onClick={() => setLatestObjection(null)} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#9A9080', display: 'flex', padding: 2 }}>
                  <X size={12} />
                </button>
              </div>
            )}
          </div>

          {/* Right: coaching panel */}
          <div style={{ flex: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#F5F0E8' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 12px' }}>

              {/* Objections */}
              <div style={{ padding: '9px 12px', backgroundColor: '#FDFAF5', borderBottom: '1px solid #DDD5BB', position: 'sticky', top: 0, zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#7A7060' }}>OBJECTIONS CAUGHT</span>
                {objections.length > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#C0392B', backgroundColor: 'rgba(192,57,43,0.1)', padding: '2px 8px', borderRadius: 10 }}>
                    {objections.length}
                  </span>
                )}
              </div>

              <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {objections.length === 0 ? (
                  <p style={{ margin: 0, padding: '4px 2px', color: '#9A9080', fontSize: 13, fontStyle: 'italic' }}>No objections detected yet.</p>
                ) : objections.map(obj => (
                  <div key={obj.id} style={{ borderRadius: 10, border: '1px solid #DDD5BB', overflow: 'hidden', backgroundColor: '#FDFAF5' }}>
                    <div style={{ padding: '7px 12px', backgroundColor: 'rgba(192,57,43,0.05)', borderBottom: '1px solid rgba(192,57,43,0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#C0392B' }}>{obj.label}</span>
                      <span style={{ fontSize: 10, color: '#9A9080' }}>{obj.time}</span>
                    </div>
                    <div style={{ padding: '9px 12px' }}>
                      <p style={{ margin: '0 0 7px', fontSize: 12, color: '#7A7060', fontStyle: 'italic', lineHeight: 1.5 }}>&ldquo;{obj.quote}&rdquo;</p>
                      <div style={{ backgroundColor: '#F5F0E8', border: '1px solid #DDD5BB', borderRadius: 7, padding: '7px 10px', marginBottom: 7 }}>
                        <p style={{ margin: '0 0 3px', fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', color: '#8C6D2F' }}>SUGGESTED RESPONSE</p>
                        <p style={{ margin: 0, fontSize: 12, color: '#2C2A1E', lineHeight: 1.6 }}>{obj.response}</p>
                      </div>
                      <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: '#4A7C59' }}>
                        NEXT MOVE &nbsp;<span style={{ fontWeight: 400, color: '#5A6A50', letterSpacing: 0 }}>{obj.nextMove}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Sentiment */}
              <div style={{ margin: '4px 10px 0', borderRadius: 10, border: '1px solid #DDD5BB', overflow: 'hidden', backgroundColor: '#FDFAF5' }}>
                <div style={{ padding: '7px 12px', borderBottom: '1px solid #DDD5BB' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#7A7060' }}>PROSPECT SENTIMENT</span>
                </div>
                <div style={{ padding: '10px 12px' }}>
                  {lines.filter(l => l.speaker === 'prospect').length === 0 ? (
                    <p style={{ margin: 0, fontSize: 12, color: '#9A9080', fontStyle: 'italic' }}>Waiting for prospect speech…</p>
                  ) : (
                    <>
                      <div style={{ display: 'flex', gap: 4, marginBottom: 9 }}>
                        {(['Negative', 'Neutral', 'Positive'] as const).map(label => {
                          const active = sentiment.label === label
                          const col = label === 'Positive' ? '#4A7C59' : label === 'Negative' ? '#C0392B' : '#8C6D2F'
                          return (
                            <div key={label} style={{ flex: 1, textAlign: 'center', padding: '5px 4px', borderRadius: 5, backgroundColor: active ? `${col}18` : 'transparent', border: `1px solid ${active ? `${col}44` : 'transparent'}`, fontSize: 11, fontWeight: active ? 700 : 500, color: active ? col : '#B0A898' }}>
                              {label}
                            </div>
                          )
                        })}
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: 'linear-gradient(to right, #C0392B 0%, #DDD5BB 50%, #4A7C59 100%)', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: '50%', left: `${sentiment.pct}%`, transform: 'translate(-50%, -50%)', width: 10, height: 10, borderRadius: '50%', backgroundColor: sentiment.color, border: '2px solid #FDFAF5', boxShadow: '0 1px 4px rgba(0,0,0,0.2)', transition: 'left 0.4s ease' }} />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Key moments */}
              {keyMoments.length > 0 && (
                <div style={{ margin: '8px 10px 0', borderRadius: 10, border: '1px solid #DDD5BB', overflow: 'hidden', backgroundColor: '#FDFAF5' }}>
                  <div style={{ padding: '7px 12px', borderBottom: '1px solid #DDD5BB', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#7A7060' }}>KEY MOMENTS</span>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#8C6D2F', backgroundColor: 'rgba(140,109,47,0.1)', padding: '1px 7px', borderRadius: 8 }}>{keyMoments.length}</span>
                  </div>
                  <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {keyMoments.map(km => (
                      <div key={km.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <span style={{ color: '#8C6D2F', fontSize: 11, flexShrink: 0, marginTop: 1 }}>✦</span>
                        <div>
                          <p style={{ margin: 0, fontSize: 12, color: '#2C2A1E', lineHeight: 1.5 }}>{km.text}</p>
                          <span style={{ fontSize: 10, color: '#B0A898' }}>{km.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Summary modal ── */}
      {showSummary && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(245,240,232,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 50 }}>
          <div style={{ backgroundColor: '#FDFAF5', border: '1px solid #DDD5BB', borderRadius: 16, padding: '36px 32px', maxWidth: 520, width: '100%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1A', margin: '0 0 3px' }}>Call Complete</h2>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', color: '#4A7C59', backgroundColor: 'rgba(74,124,89,0.1)', padding: '2px 8px', borderRadius: 4 }}>{FOCUS_BADGE[callFocus]}</span>
              </div>
              <span style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, color: scoreColor }}>{score.toFixed(1)}<span style={{ fontSize: 11, color: '#B0A898', fontWeight: 400 }}>/10</span></span>
            </div>
            <p style={{ fontSize: 13, color: '#7A7060', margin: '10px 0 16px' }}>
              Duration: {fmt(elapsed)} &nbsp;·&nbsp; {lines.length} lines &nbsp;·&nbsp; {objections.length} objection{objections.length !== 1 ? 's' : ''} &nbsp;·&nbsp; {keyMoments.length} key moment{keyMoments.length !== 1 ? 's' : ''}
            </p>

            {lines.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#4A7C59' }}>YOU {agentPct}%</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#8C6D2F' }}>PROSPECT {prospectPct}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${agentPct}%`, backgroundColor: '#4A7C59' }} />
                  <div style={{ flex: 1, backgroundColor: '#8C6D2F' }} />
                </div>
              </div>
            )}

            {objections.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#7A7060' }}>OBJECTIONS</p>
                {objections.map((obj, i) => (
                  <div key={obj.id} style={{ borderRadius: 9, border: '1px solid #DDD5BB', overflow: 'hidden' }}>
                    <div style={{ padding: '7px 13px', backgroundColor: 'rgba(192,57,43,0.05)', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#C0392B' }}>{i + 1}. {obj.label}</span>
                      <span style={{ fontSize: 11, color: '#9A9080' }}>@ {obj.time}</span>
                    </div>
                    <p style={{ margin: 0, padding: '7px 13px', fontSize: 12, color: '#7A7060', fontStyle: 'italic' }}>&ldquo;{obj.quote}&rdquo;</p>
                  </div>
                ))}
              </div>
            )}

            {keyMoments.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#7A7060' }}>KEY MOMENTS</p>
                {keyMoments.map(km => (
                  <div key={km.id} style={{ display: 'flex', gap: 7, marginBottom: 4, alignItems: 'flex-start' }}>
                    <span style={{ color: '#8C6D2F', fontSize: 11, flexShrink: 0, marginTop: 1 }}>✦</span>
                    <p style={{ margin: 0, fontSize: 12, color: '#2C2A1E' }}>{km.text} <span style={{ color: '#B0A898' }}>@ {km.time}</span></p>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                onClick={() => {
                  setShowSummary(false); setStatusSynced('ready')
                  setLines([]); setObjections([]); setElapsed(0); setErr('')
                  setScore(7.0); setSentimentScore(0)
                }}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, backgroundColor: '#1A2C1E', color: '#C8D9CB', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                New Call
              </button>
              <Link href="/dashboard" style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid #DDD5BB', color: '#7A7060', fontWeight: 600, fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:.35} }
      `}</style>
    </div>
  )
}
