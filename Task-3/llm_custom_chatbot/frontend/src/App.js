import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Box, AppBar, Toolbar, Typography, IconButton, Paper, Avatar, InputBase, Button, CircularProgress,
  CssBaseline, Drawer, List, ListItem, ListItemText, Divider
} from '@mui/material';
import { Send, Brightness4, Brightness7, Add } from '@mui/icons-material';

// Format AI response: paragraphs and bullet points, no nested <p>
function formatResponse(text) {
  const lines = text.split('\n');
  const items = [];
  let list = [];
  lines.forEach((line, idx) => {
    if (line.startsWith('- ')) {
      list.push(line.slice(2));
    } else {
      if (list.length) {
        items.push(<ul key={'ul'+idx}>{list.map((li, i) => <li key={i}>{li}</li>)}</ul>);
        list = [];
      }
      if (line.trim() !== '') {
        items.push(<p key={'p'+idx}>{line}</p>);
      }
    }
  });
  if (list.length) {
    items.push(<ul key={'ul-last'}>{list.map((li, i) => <li key={i}>{li}</li>)}</ul>);
  }
  return <>{items}</>;
}

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <Box display="flex" justifyContent={isUser ? 'flex-end' : 'flex-start'} mb={1}>
      {!isUser && <Avatar sx={{ bgcolor: '#673ab7', mr: 1 }}>AI</Avatar>}
      <Paper
        elevation={3}
        sx={{
          p: 2,
          bgcolor: isUser ? '#e3f2fd' : '#ede7f6',
          maxWidth: '70%',
          borderRadius: 3,
        }}
      >
        <Typography variant="body2" color="textSecondary" gutterBottom>
          {isUser ? 'You' : 'AI'}
        </Typography>
        <Box>
          {msg.role === 'assistant' ? formatResponse(msg.content) : <p>{msg.content}</p>}
        </Box>
      </Paper>
      {isUser && <Avatar sx={{ bgcolor: '#1976d2', ml: 1 }}>U</Avatar>}
    </Box>
  );
}

function Sidebar({ chats, activeId, onSelect, onNew }) {
  return (
    <Drawer variant="permanent" anchor="left" sx={{
      width: 240,
      flexShrink: 0,
      [`& .MuiDrawer-paper`]: { width: 240, boxSizing: 'border-box' },
    }}>
      <Toolbar />
      <Box sx={{ overflow: 'auto', p: 2 }}>
        <Typography variant="h6" gutterBottom>Chats</Typography>
        <List>
          {chats.map(chat => (
            <ListItem
              button
              key={chat.id}
              selected={chat.id === activeId}
              onClick={() => onSelect(chat.id)}
            >
              <ListItemText primary={chat.title} />
            </ListItem>
          ))}
        </List>
        <Divider sx={{ my: 2 }} />
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={onNew}
          fullWidth
        >
          New Chat
        </Button>
      </Box>
    </Drawer>
  );
}

function App() {
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const chatEndRef = useRef(null);

  // Fetch chat list
  useEffect(() => {
    axios.get('http://localhost:8000/api/conversations')
      .then(res => {
        setChats(res.data);
        if (res.data.length > 0 && !activeChatId) {
          setActiveChatId(res.data[0].id);
        }
      });
    // eslint-disable-next-line
  }, []);

  // Fetch messages for active chat
  useEffect(() => {
    if (activeChatId) {
      axios.get(`http://localhost:8000/api/conversations/${activeChatId}`)
        .then(res => setMessages(res.data));
    }
  }, [activeChatId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async () => {
    if (!input.trim() || loading || !activeChatId) return;
    setLoading(true);
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    try {
      const res = await axios.post(
        `http://localhost:8000/api/conversations/${activeChatId}/message`,
        { message: input }
      );
      setMessages(prev => [...prev, res.data]);
      // Refresh chat list to update sidebar titles
      const chatListRes = await axios.get('http://localhost:8000/api/conversations');
      setChats(chatListRes.data);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error: Could not get response.' }]);
    }
    setLoading(false);
  };

  const handleThemeToggle = () => setDarkMode(!darkMode);

  const handleNewChat = async () => {
    const res = await axios.post('http://localhost:8000/api/conversations');
    setChats(prev => [...prev, res.data]);
    setActiveChatId(res.data.id);
    setMessages([]);
  };

  return (
    <Box sx={{ bgcolor: darkMode ? '#121212' : '#fafafa', minHeight: '100vh', display: 'flex' }}>
      <CssBaseline />
      <Sidebar
        chats={chats}
        activeId={activeChatId}
        onSelect={setActiveChatId}
        onNew={handleNewChat}
      />
      <Box sx={{ flex: 1, ml: '240px', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <AppBar position="static" color={darkMode ? 'primary' : 'default'}>
          <Toolbar>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>LLaMA 3 Chatbot</Typography>
            <IconButton onClick={handleThemeToggle} color="inherit">
              {darkMode ? <Brightness7 /> : <Brightness4 />}
            </IconButton>
          </Toolbar>
        </AppBar>
        <Box flex={1} display="flex" flexDirection="column" justifyContent="flex-end" sx={{ p: 2 }}>
          <Box sx={{
            flex: 1,
            overflowY: 'auto',
            mb: 2,
            bgcolor: darkMode ? '#181818' : '#fff',
            borderRadius: 2,
            boxShadow: 1,
            p: 2,
            maxHeight: '70vh'
          }}>
            {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
            {loading && (
              <Box display="flex" alignItems="center" mt={2}>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                <Typography variant="body2">AI is typing…</Typography>
              </Box>
            )}
            <div ref={chatEndRef} />
          </Box>
          <Paper component="form" onSubmit={e => { e.preventDefault(); sendMessage(); }} sx={{ p: '4px 8px', display: 'flex', alignItems: 'center' }}>
            <InputBase
              sx={{ ml: 1, flex: 1 }}
              placeholder="Type your message…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              disabled={loading}
            />
            <Button
              color="primary"
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              endIcon={<Send />}
              sx={{ ml: 1 }}
              type="submit"
              variant="contained"
            >
              Send
            </Button>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}

export default App;
