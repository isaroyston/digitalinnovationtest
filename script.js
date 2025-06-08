const audioButton = document.querySelector(".audio-button");
const chatBox = document.querySelector(".chat-box");
const webcamVideo = document.querySelector(".webcam-video");
const explainingVideo = document.getElementById("explainingVideo");
const avatarImage = document.querySelector(".avatar-video"); // Get the static avatar image element

const DEEPSEEK_API_KEY = "sk-0e19faf29ca241e4bab6264a0536232b"; // Please ensure this key is kept secure and not exposed publicly in production
const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

// Start webcam stream
// ... other constant declarations ...

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
      speakText(assistantReply); // This might pause the video
    } catch (err) {
      console.error("Deepseek API 出错:", err);
      displayText("助手：哎呀，我出错了，请再试一次。");
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
  };

  recognition.onend = () => {
    // Optional: actions to take when recognition service has disconnected
    // For example, update UI if not already handled by mouseup/mouseleave
    if (chatBox.innerText === "正在聆听中，请说话...") {
        chatBox.innerText = "请点击麦克风和我说话吧～";
    }
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
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";

  utterance.onstart = () => {
    console.log("Speech synthesis started.");
    avatarImage.style.display = "none"; // Hide static avatar image
    explainingVideo.style.display = "block"; // Show explaining video
    explainingVideo.currentTime = 0; // Start from the beginning
    explainingVideo.play().catch(err => console.error("Explaining video play failed:", err));

    // If the browser pauses the webcam, we'll try to resume it later.
    // We are no longer explicitly hiding the webcam feed here.
  };

  utterance.onend = () => {
    console.log("Speech synthesis ended.");
    explainingVideo.pause();
    explainingVideo.style.display = "none"; // Hide explaining video
    avatarImage.style.display = "block"; // Show static avatar image

    // Attempt to play the webcam video again if it was paused by the browser
    if (webcamVideo.paused) {
      console.log("Attempting to resume webcam video playback after speech.");
      webcamVideo.play().catch(err => {
        console.error("Failed to resume webcam video playback after speech:", err);
      });
    }
  };

  utterance.onerror = (event) => {
    console.error("Speech synthesis error:", event.error);
    explainingVideo.pause();
    explainingVideo.style.display = "none"; // Hide explaining video
    avatarImage.style.display = "block"; // Show static avatar image

    // Also try to resume webcam video if it was paused by the browser
    if (webcamVideo.paused) {
      console.log("Attempting to resume webcam video playback after speech error.");
      webcamVideo.play().catch(err => {
        console.error("Failed to resume webcam video playback after speech error:", err);
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
