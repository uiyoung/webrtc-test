const socket = io();

let roomId;
let localStream = null;
let peerConnection;

const localVideo = document.querySelector('#localVideo');
const remoteVideo = document.querySelector('#remoteVideo');
const roomIdInput = document.querySelector('#roomId');
const readyButton = document.querySelector('#readyButton');
const mediaToggleButton = document.querySelector('#mediaToggleButton');
const joinButton = document.querySelector('#joinButton');
const leaveButton = document.querySelector('#leaveButton');
const roomInfoText = document.querySelector('#roomInfo');

async function getMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localVideo.srcObject = localStream;
  } catch (error) {
    console.error('미디어 장치 접근 실패', error);
    throw error;
  }
}

function enableMedia() {
  localStream?.getTracks().forEach((track) => {
    track.enabled = true;
    console.log(`${track.kind} ${track.id} enabled`);
  });
}

function disableMedia() {
  localStream?.getTracks().forEach((track) => {
    track.enabled = false;
    console.log(`${track.kind} ${track.id} disabled`);
  });
}

// PeerConnection을 생성하고 ICE candidate를 처리하는 함수
function createPeerConnection() {
  const configuration = {
    iceServers: [
      {
        urls: [
          'stun:stun.l.google.com:19302',
          'stun:stun1.l.google.com:19302',
          'stun:stun2.l.google.com:19302',
          'stun:stun3.l.google.com:19302',
        ],
      },
    ],
  };
  peerConnection = new RTCPeerConnection(configuration);

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('candidate', { roomId, candidate: event.candidate });
    }
  };

  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  // stream 추가
  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });
}

function initCall() {
  createPeerConnection();
  socket.emit('join', roomId);
}

readyButton.addEventListener('click', async () => {
  try {
    await getMedia();
    readyButton.disabled = true;
    joinButton.disabled = false;
    document.querySelector('#videoContainer').style.display = 'flex';
  } catch (error) {
    alert('카메라나 마이크를 사용할 수 없습니다. 브라우저 설정을 확인해주세요.');
  }
});

joinButton.addEventListener('click', () => {
  roomId = roomIdInput.value.trim();
  if (!roomId) {
    alert('please enter a room id');
    roomIdInput.focus();
    return;
  }

  joinButton.disabled = true;
  roomIdInput.disabled = true;
  roomInfoText.textContent = `room ${roomId} joined`;

  initCall();
});

mediaToggleButton.addEventListener('click', async () => {
  mediaToggleButton.classList.toggle('on');
  const isCurrentlyOn = mediaToggleButton.classList.contains('on');

  if (isCurrentlyOn) {
    disableMedia();
    mediaToggleButton.textContent = 'on';
  } else {
    enableMedia();
    mediaToggleButton.textContent = 'off';
  }
});

// 방에 참가한 경우, 로컬 비디오 스트림을 추가하고 offer를 생성
socket.on('welcome', async () => {
  console.log('receive welcome');

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  socket.emit('offer', { roomId, offer });
});

// 상대방이 offer를 수신한 경우, answer를 생성
socket.on('offer', async (offer) => {
  console.log('receive offer');

  await peerConnection.setRemoteDescription(offer);

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  socket.emit('answer', { roomId, answer });
});

// 상대방이 answer를 수신한 경우, remoteDescription을 설정
socket.on('answer', async (answer) => {
  console.log('receive answer');
  await peerConnection.setRemoteDescription(answer);
});

// ICE candidate를 수신한 경우, peerConnection에 추가
socket.on('candidate', async (ice) => {
  console.log('receive ice candidate');
  await peerConnection.addIceCandidate(ice);
});
