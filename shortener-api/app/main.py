from flask import Flask, request, jsonify, redirect
from flask_jwt_extended import JWTManager, jwt_required, get_jwt_identity
from app.database import db
from app.models.url import User, Url
from app.core.config import settings
from app.core.ratelimit import rate_limit, record_failure, clear_failures
from app.core.validators import is_valid_http_url
import secrets
import string
from datetime import datetime

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = settings.DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = settings.SECRET_KEY

# CORS temporariamente desabilitado para debug
# CORS(app, origins=["http://localhost:3000", "http://127.0.0.1:3000"], supports_credentials=True, allow_headers=["Content-Type", "Authorization"], methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
jwt = JWTManager(app)
db.init_app(app)

with app.app_context():
    db.create_all()

@app.after_request
def add_cors_headers(response):
    if response:
        response.headers.add('Access-Control-Allow-Origin', settings.CORS_ORIGIN)
        response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    return response

def generate_short_code(length: int = 6) -> str:
    """Gera um código curto aleatório"""
    chars = string.ascii_letters + string.digits
    return ''.join(secrets.choice(chars) for _ in range(length))

@app.route('/')
def read_root():
    return jsonify({"message": "Bem-vindo ao Encurtador de Links!"})

@app.route('/<short_code>')
def redirect_to_url(short_code):
    url = Url.query.filter_by(short_code=short_code).first()
    if not url:
        return jsonify({"error": "URL não encontrada"}), 404

    # Defense in depth: nunca redirecionar para algo que não seja http/https
    if not is_valid_http_url(url.original_url):
        return jsonify({"error": "URL de destino inválida"}), 400

    url.clicks += 1
    db.session.commit()

    return redirect(url.original_url.strip())

@app.route('/api/v1/auth/register', methods=['POST'])
@rate_limit()
def register():
    if request.is_json:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
    else:
        # O frontend envia como 'username' para consistência
        email = request.form.get('username')
        password = request.form.get('password')

    if not email or not password:
        return jsonify({"error": "Email e senha são obrigatórios"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email já registrado"}), 400

    from app.core.security import get_password_hash
    hashed_password = get_password_hash(password)
    user = User(email=email, hashed_password=hashed_password)
    db.session.add(user)
    db.session.commit()

    return jsonify({"message": "Usuário criado com sucesso"}), 201

@app.route('/api/v1/auth/login', methods=['POST'])
@rate_limit()
def login():
    from app.core.security import verify_password, create_access_token

    if request.is_json:
        data = request.get_json()
        email = data.get('username')  # Flask-JWT expects 'username'
        password = data.get('password')
    else:
        email = request.form.get('username')  # Flask-JWT expects 'username'
        password = request.form.get('password')

    if not email or not password:
        return jsonify({"error": "Email e senha são obrigatórios"}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not verify_password(password, user.hashed_password):
        record_failure(request.remote_addr or "unknown")
        return jsonify({"error": "Email ou senha incorretos"}), 401

    clear_failures(request.remote_addr or "unknown")
    access_token = create_access_token({"sub": str(user.id)})
    return jsonify({"access_token": access_token, "token_type": "bearer"})

@app.route('/api/v1/urls/', methods=['POST'])
@jwt_required()
def create_url():
    current_user_id = get_jwt_identity()
    data = request.get_json()

    custom_code = data.get('custom_code')
    original_url = data.get('original_url')

    if not is_valid_http_url(original_url):
        return jsonify({"error": "URL inválida. Use http:// ou https://"}), 400

    original_url = original_url.strip()

    if custom_code:
        if Url.query.filter_by(short_code=custom_code).first():
            return jsonify({"error": "Código personalizado já está em uso"}), 400
        short_code = custom_code
    else:
        short_code = generate_short_code()
        while Url.query.filter_by(short_code=short_code).first():
            short_code = generate_short_code()

    url = Url(
        original_url=original_url,
        short_code=short_code,
        owner_id=int(current_user_id)
    )
    db.session.add(url)
    db.session.commit()

    return jsonify({
        "id": url.id,
        "original_url": url.original_url,
        "short_code": url.short_code,
        "short_url": f"{settings.BASE_URL}/{url.short_code}",
        "clicks": url.clicks,
        "created_at": url.created_at.isoformat()
    })

@app.route('/api/v1/urls/', methods=['OPTIONS'])
def urls_options():
    return jsonify({}), 200

@app.route('/api/v1/urls/', methods=['GET'])
@jwt_required()
def get_user_urls():
    current_user_id = get_jwt_identity()
    urls = Url.query.filter_by(owner_id=int(current_user_id)).all()

    return jsonify([{
        "id": url.id,
        "original_url": url.original_url,
        "short_code": url.short_code,
        "short_url": f"{settings.BASE_URL}/{url.short_code}",
        "clicks": url.clicks,
        "created_at": url.created_at.isoformat()
    } for url in urls])

@app.route('/api/v1/urls/<int:url_id>', methods=['DELETE'])
@jwt_required()
def delete_url(url_id):
    current_user_id = get_jwt_identity()
    url = Url.query.filter_by(id=url_id, owner_id=int(current_user_id)).first()

    if not url:
        return jsonify({"error": "URL não encontrada"}), 404

    db.session.delete(url)
    db.session.commit()

    return jsonify({"message": "URL deletada com sucesso"})
