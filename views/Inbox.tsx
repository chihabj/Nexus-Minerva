
import React, { useState, useEffect, useRef } from 'react';
import { getSmartReplySuggestions } from '../services/geminiService';

const chatHistory = [
  { id: '1', sender: 'user', text: "Hello, I'm hoping to check on the status of my vehicle.", timestamp: '10:23 AM' },
  { id: '2', sender: 'system', text: "Auto-reply sent: 'Thank you for contacting Nexus. An agent will be with you shortly.'", timestamp: '10:24 AM' },
  { id: '3', sender: 'agent', text: "Hi John! I can certainly help you with that. Let me pull up your file.", timestamp: '10:25 AM', status: 'read' },
  { id: '4', sender: 'user', text: "Great, thanks. Also, I think I need to reschedule my pickup appointment for tomorrow if possible?", timestamp: '10:28 AM' },
];

export default function Inbox() {
  const [messages, setMessages] = useState(chatHistory);
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
    loadSuggestions();
  }, [messages]);

  const loadSuggestions = async () => {
    const historyText = messages.map(m => `${m.sender}: ${m.text}`).join('\n');
    const aiSuggestions = await getSmartReplySuggestions(historyText);
    setSuggestions(aiSuggestions);
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const newMessage = {
      id: Date.now().toString(),
      sender: 'agent' as const,
      text: input,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sent' as const
    };
    setMessages([...messages, newMessage]);
    setInput('');
  };

  return (
    <div className="flex h-full bg-[#efeae2] dark:bg-background-dark/50">
      {/* List */}
      <aside className="w-[360px] flex-none bg-white dark:bg-surface-dark border-r border-slate-200 dark:border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-xl font-bold mb-4">Inbox</h3>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            <input type="text" placeholder="Search chats..." className="w-full pl-10 bg-slate-100 dark:bg-slate-800 border-none rounded-lg py-2 text-sm" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={`p-4 border-b border-slate-50 dark:border-slate-800 flex gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all ${i === 1 ? 'bg-primary/5 border-l-4 border-l-primary' : ''}`}>
              <img src={`https://picsum.photos/seed/user${i}/100/100`} className="size-12 rounded-full object-cover" alt="User" />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <span className="font-bold text-sm truncate">John Doe</span>
                  <span className="text-[10px] text-slate-400 font-medium">10:28 AM</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">Toyota Camry • 2018</p>
                <p className="text-sm text-slate-600 dark:text-slate-300 truncate mt-1">Can I reschedule my appointment?</p>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <header className="h-16 bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 shrink-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <img src="https://picsum.photos/seed/user1/100/100" className="size-10 rounded-full object-cover" alt="User" />
            <div>
              <h4 className="font-bold text-sm">John Doe</h4>
              <div className="flex items-center gap-1.5">
                <div className="size-2 bg-green-500 rounded-full"></div>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Online via WhatsApp</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 transition-all">Mark Resolved</button>
            <button className="p-2 text-slate-400 hover:text-primary transition-all"><span className="material-symbols-outlined">more_vert</span></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {messages.map((m) => (
            <div key={m.id} className={`flex flex-col ${m.sender === 'agent' ? 'items-end' : m.sender === 'system' ? 'items-center my-4' : 'items-start'}`}>
              {m.sender === 'system' ? (
                <div className="bg-amber-100 border border-amber-200 text-amber-800 text-[11px] px-4 py-1.5 rounded-full font-medium shadow-sm">
                  {m.text}
                </div>
              ) : (
                <>
                  <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                    m.sender === 'agent' ? 'bg-primary text-white rounded-br-none' : 'bg-white dark:bg-surface-dark rounded-bl-none text-slate-800 dark:text-slate-100'
                  }`}>
                    {m.text}
                  </div>
                  <div className="flex items-center gap-1 mt-1 px-1">
                    <span className="text-[10px] text-slate-400 font-medium">{m.timestamp}</span>
                    {m.sender === 'agent' && (
                      <span className={`material-symbols-outlined text-[14px] ${m.status === 'read' ? 'text-blue-400' : 'text-slate-300'}`}>done_all</span>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-white dark:bg-surface-dark border-t border-slate-200 dark:border-slate-800 shrink-0">
          {suggestions.length > 0 && (
            <div className="flex gap-2 mb-4 overflow-x-auto py-1 scrollbar-hide">
              {suggestions.map((s, idx) => (
                <button 
                  key={idx}
                  onClick={() => setInput(s)}
                  className="whitespace-nowrap px-3 py-1.5 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-semibold rounded-full border border-primary/20 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-3">
            <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1.5 border border-transparent focus-within:border-primary/50 flex items-center">
              <button className="p-2 text-slate-400 hover:text-slate-600 transition-all"><span className="material-symbols-outlined">add_circle</span></button>
              <textarea 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                placeholder="Type your message..." 
                className="w-full bg-transparent border-none focus:ring-0 text-sm py-2 resize-none max-h-32"
                rows={1}
              />
              <button className="p-2 text-slate-400 hover:text-slate-600 transition-all"><span className="material-symbols-outlined">sentiment_satisfied</span></button>
            </div>
            <button 
              onClick={handleSend}
              className="bg-primary hover:bg-primary-dark text-white p-3 rounded-xl shadow-lg shadow-primary/30 transition-all disabled:opacity-50"
              disabled={!input.trim()}
            >
              <span className="material-symbols-outlined">send</span>
            </button>
          </div>
        </div>
      </div>

      {/* Context Sidebar */}
      <aside className="w-[360px] flex-none bg-white dark:bg-surface-dark border-l border-slate-200 dark:border-slate-800 p-6 flex flex-col gap-8 overflow-y-auto custom-scrollbar">
        <div className="text-center">
          <img src="https://picsum.photos/seed/user1/200/200" className="size-24 rounded-full mx-auto mb-4 border-4 border-slate-50 dark:border-slate-800 shadow-lg object-cover" alt="User" />
          <h3 className="font-bold text-lg">John Doe</h3>
          <p className="text-xs font-bold text-primary bg-primary/10 inline-block px-3 py-1 rounded-full mt-2">PREMIUM MEMBER</p>
        </div>

        <div className="space-y-4">
          <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Vehicle Details</h4>
          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div className="flex gap-3 mb-4">
              <div className="bg-white dark:bg-slate-700 p-2 rounded-lg shadow-sm">
                <span className="material-symbols-outlined text-slate-500">directions_car</span>
              </div>
              <div>
                <p className="font-bold text-sm">Toyota Camry</p>
                <p className="text-xs text-slate-500">2018 SE • Metallic Gray</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs"><span className="text-slate-400">Plate</span><span className="font-mono font-bold">ABC-1234</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-400">VIN</span><span className="font-mono text-[10px]">JTNBE46K8900...</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-400">Mileage</span><span className="font-bold">45,203 mi</span></div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Visit History</h4>
          <div className="relative pl-6 border-l-2 border-slate-100 dark:border-slate-800 space-y-8">
            <div className="relative">
              <div className="absolute -left-[33px] top-1 size-3 rounded-full bg-green-500 border-2 border-white dark:border-surface-dark"></div>
              <p className="text-xs font-bold text-primary">CURRENT VISIT</p>
              <p className="text-sm font-bold mt-1">Regular Maintenance</p>
              <p className="text-[10px] text-slate-400">Checked in: Oct 24, 2023</p>
            </div>
            <div className="relative">
              <div className="absolute -left-[33px] top-1 size-3 rounded-full bg-slate-300 dark:bg-slate-700 border-2 border-white dark:border-surface-dark"></div>
              <p className="text-sm font-bold">Brake Pad Replacement</p>
              <p className="text-[10px] text-slate-400">Aug 05, 2023 • Invoice #4092</p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
