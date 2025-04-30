class APIService {
    static async Post(url, body, headers = null) {

        const config = {
            method: "POST",
            body: JSON.stringify(body),
        }

        if(headers) {
            config.headers = headers;
        }

        try {
            const result = await fetch(url, config);

            const response = {
                success: result.status === 200,
            };
            if(response.success) {
                response.data = await result.json();
            }

            return response;
        }
        catch (error) {
            console.log(error)
            return {error: error.message};
        }
    }

    static async Get(url, headers = null) {

        const config = {
            method: "GET",
        }

        if(headers) {
            config.headers = headers;
        }

        try {
            const result = await fetch(url, config);

            const response = {
                success: result.status === 200,
            };
            if(response.success) {
                response.data = await result.json();
            }

            return response;
        }
        catch (error) {
            console.log(error)
            return {error: error.message};
        }
    }
}

module.exports = APIService;