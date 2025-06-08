const audioButton = document.querySelector(".audio-button");
const chatBox = document.querySelector(".chat-box");
const webcamVideo = document.querySelector(".webcam-video");
// const avatarImage = document.getElementById('avatarImage'); // Removed
const avatarIdleVideo = document.getElementById('avatarIdleVideo');
const avatarTalkingVideo = document.getElementById('avatarTalkingVideo'); // Renamed from avatarVideo
const avatarGoodbyeVideo = document.getElementById('avatarGoodbyeVideo');

// Elements for background switching (ensure these are declared if not already)
const backgroundElement = document.querySelector('.background');
const lightButtonOne = document.querySelector('.light-button-one');
const lightButtonTwo = document.querySelector('.light-button-two');
const lightButtonThree = document.querySelector('.light-button-three');

// Divs whose background color needs to change (ensure these are declared if not already)
const macbookProDiv = document.querySelector('.macbook-pro');
const overlapGroupWrapperDiv = document.querySelector('.macbook-pro .overlap-group-wrapper');

const DEEPSEEK_API_KEY = "sk-0e19faf29ca241e4bab6264a0536232b";
const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

const FADE_DURATION = 300;
let activeAvatarVideo = null; // Stores the DOM element of the currently active video

function playVideo(videoElement) {
  if (videoElement) {
    videoElement.play().catch(error => console.error("Avatar video play failed:", videoElement.id, error));
  }
}

function switchAvatarVideo(newVideoElement, loop = true) {
    const currentActive = activeAvatarVideo;

    // If trying to switch to the same video that's already visibly active, ensure it's playing and do nothing else.
    if (currentActive === newVideoElement && currentActive && currentActive.style.display !== 'none' && currentActive.style.opacity === '1') {
        if (currentActive.paused) {
            playVideo(currentActive);
        }
        return;
    }

    // Immediately start fading out the current video if it exists and is different
    if (currentActive && currentActive !== newVideoElement) {
        currentActive.style.opacity = '0';
    }

    // Pause all videos that are not the new one.
    // Hide them after a delay if they were the 'currentActive' one that was fading.
    [avatarIdleVideo, avatarTalkingVideo, avatarGoodbyeVideo].forEach(vid => {
        if (vid && vid !== newVideoElement) {
            vid.pause(); // Pause immediately
            vid.currentTime = 0; // Reset time
            if (vid === currentActive && currentActive !== newVideoElement) {
                // This was the video that is now fading out, hide it after the fade
                setTimeout(() => {
                    if (vid.style.opacity === '0') { // Ensure it's still meant to be hidden
                        vid.style.display = 'none';
                    }
                }, FADE_DURATION);
            } else {
                // This video was not the one actively fading out, hide it immediately
                // and ensure its opacity is 0 (in case of rapid switches)
                vid.style.display = 'none';
                vid.style.opacity = '0';
            }
        }
    });

    if (newVideoElement) {
        // Delay showing the new video if an old one was fading out (for cross-fade effect)
        const delay = (currentActive && currentActive !== newVideoElement) ? FADE_DURATION : 0;

        setTimeout(() => {
            // Ensure again that other videos are hidden, in case of very quick successive calls
            [avatarIdleVideo, avatarTalkingVideo, avatarGoodbyeVideo].forEach(vid => {
                if (vid && vid !== newVideoElement) {
                    vid.style.display = 'none';
                    vid.style.opacity = '0';
                    if (!vid.paused) vid.pause(); // Extra check
                }
            });

            newVideoElement.style.display = 'block';
            newVideoElement.loop = loop;
            newVideoElement.currentTime = 0;
            
            // Force a reflow before applying opacity for transition to work reliably
            // Reading offsetHeight is a common way to trigger reflow
            // eslint-disable-next-line no-unused-expressions
            newVideoElement.offsetHeight; 

            newVideoElement.style.opacity = '1';
            playVideo(newVideoElement);
            activeAvatarVideo = newVideoElement;
        }, delay);
    } else {
        // If no new video, ensure the current one (if any) is fully hidden after its fade
        if (currentActive) {
            setTimeout(() => {
                if (currentActive.style.opacity === '0') {
                    currentActive.style.display = 'none';
                    currentActive.pause(); // Ensure it's paused
                }
            }, FADE_DURATION);
        }
        activeAvatarVideo = null;
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
      if (userSaidGoodbye) {
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
          content: "你是一位温柔友善的AI美妆助手。请用鼓励和友善的语气帮助用户，保持回答简短扼要。如果需要列出几点，请使用短划线 (-) 或数字 (1., 2.) 来分隔，避免使用星号 (*)。",
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
showAvatarIdle(); // Call this to initialize the state via JS;

// Background image paths
const backgroundOriginalSrc = 'img/background.svg';
const backgroundWhiteSrc = 'img/background-white.svg'; // For lightButtonOne
const backgroundThreeSrc = 'img/background-three.svg'; // For lightButtonThree

// Corresponding CSS background colors
const colorOriginal = '#ffebc8'; // For backgroundOriginalSrc (linked to lightButtonTwo)
const colorWhite = '#FFFFFF';   // For backgroundWhiteSrc (linked to lightButtonOne)
const colorThree = '#FAC17A';   // For backgroundThreeSrc (linked to lightButtonThree)

if (backgroundElement && lightButtonOne && lightButtonTwo && lightButtonThree && macbookProDiv && overlapGroupWrapperDiv) {
  // Light Button One (sets "white" theme)
  lightButtonOne.addEventListener('click', () => {
    backgroundElement.src = backgroundWhiteSrc;
    macbookProDiv.style.backgroundColor = colorWhite;
    overlapGroupWrapperDiv.style.backgroundColor = colorWhite;
    console.log('Background set to white theme (Button 1)');
  });

  // Light Button Two (sets "original" theme)
  lightButtonTwo.addEventListener('click', () => {
    backgroundElement.src = backgroundOriginalSrc;
    macbookProDiv.style.backgroundColor = colorOriginal;
    overlapGroupWrapperDiv.style.backgroundColor = colorOriginal;
    console.log('Background set to original theme (Button 2)');
  });

  // Light Button Three (sets "three" theme)
  lightButtonThree.addEventListener('click', () => {
    backgroundElement.src = backgroundThreeSrc;
    macbookProDiv.style.backgroundColor = colorThree;
    overlapGroupWrapperDiv.style.backgroundColor = colorThree;
    console.log('Background set to three theme (Button 3)');
  });
} else {
  console.error('One or more elements for background switching not found. Background switching will not work completely.');
  if (!backgroundElement) console.error('backgroundElement not found');
  if (!lightButtonOne) console.error('lightButtonOne not found');
  if (!lightButtonTwo) console.error('lightButtonTwo not found');
  if (!lightButtonThree) console.error('lightButtonThree not found');
  if (!macbookProDiv) console.error('macbookProDiv not found');
  if (!overlapGroupWrapperDiv) console.error('overlapGroupWrapperDiv not found');
}