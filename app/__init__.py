"""Magnetar Finder Flask application factory."""
import os
from flask import Flask
from flask_cors import CORS


def create_app():
    app = Flask(
        __name__,
        static_folder=os.path.join(os.path.dirname(__file__), "..", "frontend"),
        static_url_path="",
    )
    app.config["SECRET_KEY"] = os.urandom(24).hex()
    CORS(app)

    from .core.results_db import init_db
    init_db()

    from .api import databases, search, results, unique, settings as settings_api
    app.register_blueprint(databases.bp)
    app.register_blueprint(search.bp)
    app.register_blueprint(results.bp)
    app.register_blueprint(unique.bp)
    app.register_blueprint(settings_api.bp)

    @app.route("/")
    def index():
        return app.send_static_file("index.html")

    return app
