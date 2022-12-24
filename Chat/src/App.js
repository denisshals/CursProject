import { useEffect, useRef, useState } from 'react';
import './App.css';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/auth';
// хуки из node-пакета firebase
import { useAuthState } from 'react-firebase-hooks/auth';
import { useCollectionData } from 'react-firebase-hooks/firestore'


// конфигурация профиля приложения в firebase
firebase.initializeApp({
  apiKey: "AIzaSyAojgkXmozM_HnCLV0hq1_BRZBO0HYpq-M",
  authDomain: "chat-ae62a.firebaseapp.com",
  projectId: "chat-ae62a",
  storageBucket: "chat-ae62a.appspot.com",
  messagingSenderId: "58043589802",
  appId: "1:58043589802:web:627be3274f7e5b676c5cd3"
})

firebase.auth().useDeviceLanguage();
const auth = firebase.auth();
const firestore = firebase.firestore();

function App() {
  //проверка в сервисе авторизации авторизован ли пользователь
  const [user] = useAuthState(auth);

  return (
    <div className="App">
      <header >
        <h1>Web Chat</h1>
        <SignOut />
      </header>

      <section>
        {/* условный рендеринг в зависимости от того, авторизован ли пользователь */}
        {user ? <ChatRoom /> : <SignIn />}
      </section>

    </div>
  );
}

function SignIn() {
  const [phone, setPhone] = useState("");

 const signInWithPhone = () => {
   //Делаем каптчу невидимой для тестового проекта(!). Чтобы ускорить работу. Так как это необходимый элемент метода смс-подтверждения в firebase
  const captcha = new firebase.auth.RecaptchaVerifier("recaptcha-container", {
    size: "invisible",
  });
  //Сам метод смс-авторизации. Код адаптирован отсюда https://firebase.google.com/docs/auth/web/phone-auth
  auth.signInWithPhoneNumber(phone, captcha)
    .then((e) => {
      const code = prompt("Введіть код з СМС", "");
      if (code === null) return;
//регистрируем код из смс
      e.confirm(code)
        .then((result) => {
          console.log(result.user);

          document.querySelector("label").textContent += result.user.phone + "Номер підтверджено";
        })
        .catch((error) => {
          console.error(error);
        });
    })
    .catch((error) => {
      console.error(error);
    });
 }
  
  const signInWithGoogle = () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    //Метод авторизации с помощью гугл аккаунта
    auth.signInWithPopup(provider);
  }
  return (
    <>
      <div className="google-box">
      <div className="google-btn" onClick={signInWithGoogle}>
          <div className="google-icon-wrapper" >
            <img className="google-icon" src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" alt="logo"/>
          </div>
        <div className="btn-text"><b>Увійти за допомогою Google</b></div>
      </div>
      <br />
      <div className="container">
        <div id="recaptcha-container" />
      </div>
      </div>
      <div className="flex-box">
      <input
        className="phone-holder"
        placeholder="Введіть номер телефону"
        type="phone"
        value={phone}
        onChange={(e) => {
          setPhone(e.target.value);
        }}
      />
      <button id="phone" type="button" onClick={signInWithPhone}>
        Увійти за допомогою СМС
      </button>
      <label></label>
      </div>
    </>
    
  )

}
//Функция выхода. Использует метод сервиса auth - signOut. Проверяет существует ли залогиненый юзер
const SignOut = () => {
  return (
    auth.currentUser && (
      <button type="button" onClick={() => auth.signOut()}>
        Вихід
      </button>
    )
  );
};

function ChatRoom() {

  //Стейт для временного хранения введенного текста перед отправкой его на сервер.
  const [formValue, setFormValue] = useState("");

  const dummy = useRef();//привязка к пустому спану, чтобы можно было управлять автоматической прокруткой

  const messagesRef = firestore.collection("messages"); //Подвязывание коллекции 'messages' в БД firestore
  const query = messagesRef.orderBy("createdAt").limitToLast(25); 

  const [messages] = useCollectionData(query, { idField: "id" }); //Хук прослушивает изменения в коллекции 'messages'. Возвращает массив с объектами, где каждый объект это сообщение.

  //Обработчик сабмита. Отправляет введенный в форме текст на сервер.
  const sendMessage = async (e) => {
    e.preventDefault();
    const { uid, photoURL } = auth.currentUser;

    //прикрепляем изображение пользователя в зависимости от того, как он залогинился
    //Если через гугл-аккаунт, то аватарка берется из него, если через смс - то дефолтная картинка
    const avatarPhoto = photoURL ? photoURL : "https://bit.ly/348yGrm"

    //метод добавления новой записи в БД
    await messagesRef.add({
      text: formValue,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),//Добавляем тайм-стамп к каждому сообщению как уникальный айдишник
      uid,
      avatarPhoto,
    });

    setFormValue("");//очищение формы после отправки сообщения
  };

  //хук для автоматической прокрутки чата к последнему сообщению.
  useEffect(() => {
    dummy.current.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (<>
    <div className="text-field">
      {messages &&
        messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
      </div>
      <div className="send-form">
      <span ref={dummy} />
      <form onSubmit={sendMessage}>
        <input
          value={formValue}
          onChange={(e) => setFormValue(e.target.value)}
          placeholder="Напишіть що-небудь"
        />
        <button type="submit" disabled={!formValue}>
        📤
        </button>
      </form>
      </div>
    

  </>)
}



const ChatMessage = ({ message }) => {
  const { text, uid, avatarPhoto } = message;
//условный выбор названия css-класса в зависимости от того ваше сообщение или других участников. Чисто для стилизации.
  const messageClass = uid === auth.currentUser.uid ? 'sent' : 'received';
//рендер самого сообщения. Объект сообщения берется из пропсов. 
  return (<>
    <div className={`message ${messageClass}`}>
      <img src={avatarPhoto} alt="avatar"/>
      <p>{text}</p>
    </div>
  </>)
}

export default App;
