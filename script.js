const audioButton = document.querySelector(".audio-button");
const chatBox = document.querySelector(".chat-box");
const webcamVideo = document.querySelector(".webcam-video");
// const avatarImage = document.getElementById('avatarImage'); // Removed
const avatarIdleVideo = document.getElementById('avatarIdleVideo');
const avatarTalkingVideo = document.getElementById('avatarTalkingVideo'); // Renamed from avatarVideo
const avatarGoodbyeVideo = document.getElementById('avatarGoodbyeVideo');

const DEEPSEEK_API_KEY = "sk-0e19faf29ca241e4bab6264a0536232b";
const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

const FADE_DURATION = 300;
let activeAvatarVideo = null; // Stores the DOM element of the currently active video

function playVideo(videoElement) {
  if (videoElement) {
    videoElement.play().catch(error => console.error("Avatar video play failed:", videoElement.id, error));
  }
}

function switchAvatarVideo(newVideo, loop = true) {
  const oldVideo = activeAvatarVideo;

  if (oldVideo === newVideo && oldVideo && oldVideo.style.display !== 'none') {
    if (oldVideo.paused) playVideo(oldVideo);
    return;
  }

  if (oldVideo && oldVideo !== newVideo) {
    oldVideo.style.opacity = '0';
    setTimeout(() => {
      if (oldVideo.style.opacity === '0') { // Check if it wasn't changed again
          oldVideo.style.display = 'none';
          oldVideo.pause();
      }
    }, FADE_DURATION);
  }

  if (newVideo) {
    const delay = (oldVideo && oldVideo !== newVideo) ? FADE_DURATION : 0;
    setTimeout(() => {
      // Ensure any other avatar videos are hidden if a quick switch happened
      [avatarIdleVideo, avatarTalkingVideo, avatarGoodbyeVideo].forEach(vid => {
        if (vid && vid !== newVideo) {
          vid.style.display = 'none';
          vid.style.opacity = '0';
          vid.pause();
        }
      });

      newVideo.style.display = 'block';
      newVideo.loop = loop;
      newVideo.currentTime = 0;
      requestAnimationFrame(() => { // Ensure display:block is rendered before opacity transition
        newVideo.style.opacity = '1';
      });
      playVideo(newVideo);
      activeAvatarVideo = newVideo;
    }, delay);
  } else if (oldVideo) { // If newVideo is null, just hide the old one
    oldVideo.style.opacity = '0';
    setTimeout(() => {
      if (oldVideo.style.opacity === '0') {
          oldVideo.style.display = 'none';
          oldVideo.pause();
      }
      activeAvatarVideo = null;
    }, FADE_DURATION);
  }
}

function showAvatarIdle() {
  switchAvatarVideo(avatarIdleVideo, true);
}

function showAvatarTalking() {
  switchAvatarVideo(avatarTalkingVideo, true);
}

function showAvatarGoodbye() {
  switchAvatarVideo(avatarGoodbyeVideo, false); // Goodbye video does not loop
  if (avatarGoodbyeVideo) {
    avatarGoodbyeVideo.onended = () => {
      showAvatarIdle(); // Go back to idle after goodbye video finishes
    };
  }
}

// Initial state setup:
// The HTML for avatarIdleVideo has autoplay, so it should start.
// We ensure JS knows it's the active one.
if (avatarIdleVideo) {
    activeAvatarVideo = avatarIdleVideo;
    // Ensure others are correctly hidden if HTML wasn't perfect
    if(avatarTalkingVideo) {
        avatarTalkingVideo.style.display = 'none';
        avatarTalkingVideo.style.opacity = '0';
    }
    if(avatarGoodbyeVideo) {
        avatarGoodbyeVideo.style.display = 'none';
        avatarGoodbyeVideo.style.opacity = '0';
    }
} else {
    console.error("avatarIdleVideo not found for initial setup.");
}


async function startWebcam() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    webcamVideo.srcObject = stream;
    webcamVideo.onloadedmetadata = () => {
      webcamVideo.play().then(() => {
        console.log("Webcam video playing.");
      }).catch(err => {
        console.error("Webcam video play failed:", err);
        chatBox.innerText = "无法播放摄像头视频，请检查浏览器设置。";
      });
    };
  } catch (err) {
    console.error("无法访问摄像头:", err);
    chatBox.innerText = "无法访问摄像头，请检查权限设置。";
  }
}
startWebcam();


const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
if (recognition) {
  recognition.lang = "zh-CN";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  audioButton.addEventListener("mousedown", () => {
    chatBox.innerText = "正在聆听中，请说话...";
    try {
      recognition.start();
    } catch (e) {
      console.error("Speech recognition start error:", e);
      chatBox.innerText = "语音识别启动失败，请稍后再试。";
    }
  });

  audioButton.addEventListener("mouseup", () => {
    recognition.stop();
  });

  recognition.onresult = async (event) => {
    const userText = event.results[0][0].transcript;
    displayText(`你：${userText}`);

    try {
      const assistantReply = await getDeepseekReply(userText);
      displayText(`助手：${assistantReply}`);

      const userSaidGoodbye = /再见|拜拜|goodbye/i.test(userText);
      const assistantSaidGoodbye = /再见|拜拜|下次见|goodbye/i.test(assistantReply);

      if (userSaidGoodbye && assistantSaidGoodbye) {
        speakText(assistantReply, true); // Pass true for goodbye
      } else {
        speakText(assistantReply, false);
      }
    } catch (err) {
      console.error("Deepseek API 出错:", err);
      displayText("助手：哎呀，我出错了，请再试一次。");
      showAvatarIdle(); // Revert to idle on API error
    }
  };

  recognition.onerror = (event) => {
    console.error("语音识别错误", event.error);
    let errorMessage = "助手：我没有听清楚，可以再说一次吗？";
    if (event.error === 'no-speech') {
        errorMessage = "助手：我没有听到声音，请再说一次。";
    } else if (event.error === 'audio-capture') {
        errorMessage = "助手：无法获取麦克风，请检查权限。";
    } else if (event.error === 'not-allowed') {
        errorMessage = "助手：麦克风权限被拒绝，请允许访问。";
    }
    displayText(errorMessage);
    showAvatarIdle(); // Revert to idle on recognition error
  };

  recognition.onend = () => {
    if (chatBox.innerText === "正在聆听中，请说话...") {
        chatBox.innerText = "请点击麦克风和我说话吧～";
    }
  };

} else {
  chatBox.innerText = "抱歉，您的浏览器不支持语音识别功能。";
  console.error("Speech Recognition API not supported in this browser.");
  audioButton.disabled = true;
  audioButton.style.cursor = "not-allowed";
}


function displayText(text) {
  chatBox.innerText = text;
}

function speakText(text, isGoodbye = false) { // Added isGoodbye parameter
  if (!('speechSynthesis' in window)) {
    console.warn("Speech Synthesis not supported in this browser.");
    showAvatarIdle();
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";

  utterance.onstart = () => {
    console.log("Speech synthesis started.");
    showAvatarTalking(); // Always show talking animation when speech starts
  };

  utterance.onend = () => {
    console.log("Speech synthesis ended.");
    if (isGoodbye) {
      showAvatarGoodbye(); // Show goodbye animation
    } else {
      showAvatarIdle(); // Revert to idle animation
    }
    if (webcamVideo.paused) {
      webcamVideo.play().catch(err => {
        console.error("Failed to resume video playback after speech:", err);
      });
    }
  };

  utterance.onerror = (event) => {
    console.error("Speech synthesis error:", event.error);
    showAvatarIdle(); // Revert to idle on speech error
    if (webcamVideo.paused) {
      webcamVideo.play().catch(err => {
        console.error("Failed to resume video playback after speech error:", err);
      });
    }
  };

  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

async function getDeepseekReply(userInput) {
  const response = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: "你是一位温柔友善的AI美妆助理。请用鼓励和亲切的语气帮助用户，并保持回答简短扼要。",
        },
        {
          role: "user",
          content: userInput,
        },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    console.error("API Error Response:", errorData);
    throw new Error(`API request failed with status ${response.status}: ${errorData.message || 'Unknown error'}`);
  }

  const data = await response.json();
  if (data.choices && data.choices.length > 0 && data.choices[0].message && data.choices[0].message.content) {
    return data.choices[0].message.content.trim();
  } else {
    console.error("Invalid API response structure:", data);
    throw new Error("Invalid response structure from API.");
  }
}

// Ensure initial state is correctly set after all elements are potentially defined
// The HTML for avatarIdleVideo has autoplay, so it should start.
// The activeAvatarVideo variable is set above.
// If avatarIdleVideo is not found, this will log an error.
// If it is found, it's assumed to be the active one due to HTML autoplay.
// The switchAvatarVideo function will handle transitions from this state.
// No explicit call to showAvatarIdle() here is needed if HTML handles initial play.
// However, to be absolutely sure JS state matches, we can call it.
showAvatarIdle(); // Call this to initialize the state via JS.