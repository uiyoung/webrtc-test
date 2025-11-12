const socket = io();

let peerConnection = null;
let localStream = null;
let roomId = null;

const rtcConfig = {
  // ICE 서버 설정(Google 공개 STUN 서버 사용)
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

const localVideo = document.querySelector('#localVideo');
const remoteVideo = document.querySelector('#remoteVideo');
const roomIdInput = document.querySelector('#roomId');
const readyButton = document.querySelector('#readyButton');
const mediaToggleButton = document.querySelector('#mediaToggleButton');
const joinButton = document.querySelector('#joinButton');
const leaveButton = document.querySelector('#leaveButton');
const roomInfoText = document.querySelector('#roomInfo');
const videoContainer = document.querySelector('#videoContainer');

// 미디어스트림 가져오기(camera, mic)
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
  peerConnection = new RTCPeerConnection(rtcConfig);

  // 로컬 트랙을 RTCPeerConnection에 추가하여 상대방에게 전송 준비
  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  // 상대방의 ICE Candidate 수신 시 socket.io로 전송
  peerConnection.addEventListener('icecandidate', (e) => {
    if (e.candidate) {
      // 서버를 통해 상대방에게 ICE 후보 정보를 전송
      socket.emit('candidate', { roomId, candidate: e.candidate });
    }
  });

  // 상대방으로부터 스트림(트랙) 수신 시 <video>에 연결
  peerConnection.addEventListener('track', (e) => {
    remoteVideo.srcObject = e.streams[0];
  });

  // 연결 상태 로깅
  peerConnection.addEventListener('connectionstatechange', () => {
    console.log(`Connection: ${peerConnection.connectionState}`);
  });
}

function cleanup() {
  // readyButton.disabled = false;
  roomIdInput.disabled = false;
  joinButton.disabled = false;
  leaveButton.disabled = true;

  // if (peerConnection) {
  //   peerConnection.getSenders().forEach(s => s.track && s.track.stop());
  //   peerConnection.close();
  //   peerConnection = null;
  // }
  // if (localStream) {
  //   localStream.getTracks().forEach((track) => track.stop());
  //   localStream = null;
  //   localVideo.srcObject = null;
  // }
  // remoteVideo.srcObject = null;
}

readyButton.addEventListener('click', async () => {
  try {
    await getMedia();
    roomIdInput.disabled = false;
    readyButton.disabled = true;
    joinButton.disabled = false;
    videoContainer.style.display = 'flex';
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

  createPeerConnection();

  // socket.io 서버에 방 참가 요청
  socket.emit('join', roomId);

  joinButton.disabled = true;
  roomIdInput.disabled = true;
});

// TODO: 
leaveButton.addEventListener('click', () => {

});

mediaToggleButton.addEventListener('click', () => {
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

/* socket.io 시그널링 수신 처리 */
// 방 참가가 되었음을 알림
socket.on('joined', ({ roomId }) => {
  roomInfoText.textContent = `joined room #${roomId}`;
  leaveButton.disabled = false;
});

// 방이 full임을 알림
socket.on('room-full', ({roomId, clientCount}) =>{
  cleanup();
  roomInfoText.textContent = `room ${roomId} is full`
})

// 방에 두 번째 사용자가 들어와 통화 준비가 되었을 때
socket.on('peer-joined', async () => {
  // offer를 생성하고 전송(첫번째 사용자 역할)
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  socket.emit('offer', { roomId, offer });
  console.log('offer 전송 완료')
});

// 상대방이 보낸 offer를 수신한 경우, answer를 생성
socket.on('offer', async (offer) => {
  console.log('receive offer');

  await peerConnection.setRemoteDescription(offer);

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  socket.emit('answer', { roomId, answer });
});

// 상대방이 보낸 answer를 수신한 경우, remoteDescription을 설정
socket.on('answer', async (answer) => {
  console.log('receive answer');
  await peerConnection.setRemoteDescription(answer);
});

// ICE candidate를 수신한 경우, peerConnection에 추가
socket.on('candidate', async (ice) => {
  console.log('receive ice candidate');
  await peerConnection.addIceCandidate(ice);
});
