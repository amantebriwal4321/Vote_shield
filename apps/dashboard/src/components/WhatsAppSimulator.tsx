import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  text: string;
  time: Date;
}

export default function WhatsAppSimulator() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init',
      role: 'bot',
      text: '🛡️ *VoteShield* — Your Election Guardian\n\nChoose an option:\n1️⃣ *CHECK ROLL*\n2️⃣ *REPORT*\n3️⃣ *NEW VOTER*\n4️⃣ *FACT CHECK*\n5️⃣ *VS-XXXXXX*',
      time: new Date()
    }
  ]);
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const [language, setLanguage] = useState('en');

  // Auto-scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput('');
    
    // Add user message to UI immediately
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      text: userText,
      time: new Date()
    }]);

    setLoading(true);

    try {
      // Direct POST to backend WhatsApp webhook (bypassing Twilio!)
      // We pass Language to simulate a mock language session setup
      const res = await fetch('http://localhost:3000/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          From: 'whatsapp:+919999999999',
          Body: userText,
          Language: language
        })
      });

      const xmlText = await res.text();
      // Parse the Twilio XML response
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "text/xml");
      const botText = xmlDoc.getElementsByTagName("Message")[0]?.textContent || "Error parsing response.";

      setMessages(prev => [...prev, {
        id: Date.now().toString() + '-bot',
        role: 'bot',
        text: botText,
        time: new Date()
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: Date.now().toString() + '-err',
        role: 'bot',
        text: '❌ Connection error to backend.',
        time: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  }

  function formatText(text: string) {
    // Basic formatting for WhatsApp *bold* and _italic_
    let formatted = text.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/_(.*?)_/g, '<em>$1</em>');
    return formatted.split('\n').map((line, i) => (
      <span key={i}>
        <span dangerouslySetInnerHTML={{ __html: line }} />
        <br />
      </span>
    ));
  }
  function handleReset() {
    setMessages([
      {
        id: 'init',
        role: 'bot',
        text: '🛡️ *VoteShield* — Your Election Guardian\n\nChoose an option:\n1️⃣ *CHECK ROLL*\n2️⃣ *REPORT*\n3️⃣ *NEW VOTER*\n4️⃣ *FACT CHECK*\n5️⃣ *VS-XXXXXX*',
        time: new Date()
      }
    ]);
  }

  return createPortal(
    <div className="whatsapp-simulator-portal" style={{ position: 'fixed', zIndex: 99999 }}>
      {/* Floating Toggle Button */}
      <div className="fixed bottom-6 right-6 flex flex-col items-end gap-3 z-50">
        {!isOpen && (
          <div className="bg-slate-800 border border-slate-700 text-slate-300 text-sm p-3 rounded-xl shadow-xl max-w-xs animate-bounce-slow">
            <p className="font-semibold text-white mb-1">Test the AI Bot! 🤖</p>
            <p className="text-xs">Simulate reporting an incident or checking misinformation in any Indian language.</p>
          </div>
        )}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-16 h-16 bg-green-500 rounded-full shadow-2xl flex items-center justify-center text-white text-3xl hover:bg-green-600 hover:scale-110 transition-all"
        >
          {isOpen ? '✕' : '💬'}
        </button>
      </div>

      {/* Slide-out Panel */}
      <div className={`fixed bottom-28 right-6 w-80 md:w-96 bg-[#0b141a] rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-slate-800 overflow-hidden flex flex-col transition-all duration-300 transform origin-bottom-right z-50 ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`} style={{ height: '600px', maxHeight: '80vh' }}>
        
        {/* WhatsApp Header */}
        <div className="bg-[#202c33] p-3 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center text-xl">🛡️</div>
              <div>
                <h3 className="font-semibold text-[#e9edef]">VoteShield Bot</h3>
                <p className="text-xs text-[#8696a0]">{loading ? 'typing...' : 'online'}</p>
              </div>
            </div>
            <button onClick={handleReset} className="text-xs text-[#00a884] hover:text-white px-2 py-1 rounded bg-[#2a3942] transition-colors" title="Start over">
              Reset
            </button>
          </div>
          
          <div className="flex items-center gap-2 mt-1 px-1">
            <span className="text-xs text-[#8696a0]">Language:</span>
            <select 
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-[#2a3942] text-[#e9edef] text-xs rounded border border-[#374b57] px-2 py-1 outline-none"
            >
              <option value="en">English</option>
              <option value="hi">हिंदी (Hindi)</option>
              <option value="ta">தமிழ் (Tamil)</option>
              <option value="te">తెలుగు (Telugu)</option>
              <option value="bn">বাংলা (Bengali)</option>
            </select>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundSize: 'cover' }}>
          {messages.map(m => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-lg p-3 text-sm shadow-md relative ${m.role === 'user' ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-none' : 'bg-[#202c33] text-[#e9edef] rounded-tl-none'}`}>
                <div className="leading-relaxed whitespace-pre-wrap">{formatText(m.text)}</div>
                <div className="text-[10px] text-[#8696a0] text-right mt-1">
                  {m.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {/* Input Area */}
        <form onSubmit={handleSend} className="bg-[#202c33] p-3 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-[#2a3942] text-[#e9edef] rounded-full px-4 py-2 text-sm focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="w-10 h-10 bg-[#00a884] rounded-full flex items-center justify-center text-white disabled:opacity-50 hover:bg-[#008f6f] transition-colors"
          >
            ➤
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
