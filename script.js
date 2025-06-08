const audioButton = document.querySelector(".audio-button");
const chatBox = document.querySelector(".chat-box");
const webcamVideo = document.querySelector(".webcam-video");
const avatarImage = document.getElementById('avatarImage');
const avatarVideo = document.getElementById('avatarVideo');

const DEEPSEEK_API_KEY = "sk-0e19faf29ca241e4bab6264a0536232b"; // Please ensure this key is kept secure and not exposed publicly in production
const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

// Function to call when the API starts talking
function showAvatarVideo() {
  if (avatarImage) avatarImage.style.display = 'none';
  if (avatarVideo) {
    avatarVideo.style.display = 'block'; // Or 'inline', 'flex', etc., depending on your layout
    avatarVideo.play().catch(error => console.error("Avatar video play failed:", error));
  }
}

// Function to call when the API stops talking
function showAvatarImage() {
  if (avatarVideo) {
    avatarVideo.style.display = 'none';
    avatarVideo.pause();
    // Optional: Reset video to the beginning
    // avatarVideo.currentTime = 0;
  }
  if (avatarImage) avatarImage.style.display = 'block'; // Or 'inline', 'flex', etc.
}

// Initial state: show the image
showAvatarImage();

async function startWebcam() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true }); // This line triggers the permission prompt
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
startWebcam(); // This ensures the function runs as soon as the script is loaded


// Initialize speech recognition
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
if (recognition) {
  recognition.lang = "zh-CN";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  // Press and hold to start, release to stop
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

  audioButton.addEventListener("mouseleave", () => {
    // Optional: stop recognition if mouse leaves button while pressed
    // recognition.stop();
  });

  recognition.onresult = async (event) => {
    const userText = event.results[0][0].transcript;
    displayText(`你：${userText}`);
    console.log("Video paused state before API call/speakText:", webcamVideo.paused);

    try {
      const assistantReply = await getDeepseekReply(userText);
      displayText(`助手：${assistantReply}`);
      speakText(assistantReply); // This will trigger avatar change
    } catch (err) {
      console.error("Deepseek API 出错:", err);
      displayText("助手：哎呀，我出错了，请再试一次。");
      showAvatarImage(); // Ensure image is shown on API error
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
    showAvatarImage(); // Ensure image is shown on recognition error
  };

  recognition.onend = () => {
    // Optional: actions to take when recognition service has disconnected
    // For example, update UI if not already handled by mouseup/mouseleave
    if (chatBox.innerText === "正在聆听中，请说话...") {
        chatBox.innerText = "请点击麦克风和我说话吧～";
    }
    // It's generally better to switch back to image when speech synthesis ends,
    // but if recognition ends abruptly, ensure the image is shown.
    // showAvatarImage(); // Consider if needed here or if onend of speakText is sufficient
  };

} else {
  chatBox.innerText = "抱歉，您的浏览器不支持语音识别功能。";
  console.error("Speech Recognition API not supported in this browser.");
  // Disable audio button if recognition is not supported
  audioButton.disabled = true;
  audioButton.style.cursor = "not-allowed";
}


function displayText(text) {
  chatBox.innerText = text;
}

function speakText(text) {
  if (!('speechSynthesis' in window)) {
    console.warn("Speech Synthesis not supported in this browser.");
    showAvatarImage(); // Ensure image is shown if speech synthesis is not supported
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";

  utterance.onstart = () => {
    console.log("Speech synthesis started. Video paused:", webcamVideo.paused);
    showAvatarVideo(); // Switch to video when assistant starts speaking
  };

  utterance.onend = () => {
    console.log("Speech synthesis ended.");
    showAvatarImage(); // Switch back to image when assistant stops speaking
    // Attempt to play the video again if it was paused
    if (webcamVideo.paused) {
      console.log("Attempting to resume video playback after speech.");
      webcamVideo.play().catch(err => {
        console.error("Failed to resume video playback after speech:", err);
      });
    }
  };

  utterance.onerror = (event) => {
    console.error("Speech synthesis error:", event.error);
    showAvatarImage(); // Switch back to image on speech error
    // Also try to resume video if it was paused and an error occurred during speech
    if (webcamVideo.paused) {
      console.log("Attempting to resume video playback after speech error.");
      webcamVideo.play().catch(err => {
        console.error("Failed to resume video playback after speech error:", err);
      });
    }
  };

  // Cancel any ongoing speech before speaking the new utterance
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
      model: "deepseek-chat", // Ensure this model name is correct
      messages: [
        {
          role: "system",
          content: "你是一位温柔友善的AI美妆助理，请用鼓励和亲切的语气帮助用户。",
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