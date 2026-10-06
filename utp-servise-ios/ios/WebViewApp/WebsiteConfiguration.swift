import Foundation

struct WebsiteConfiguration: Decodable {
    let url: URL

    static func load() throws -> URL {
        guard let resource = Bundle.main.url(forResource: "mobile", withExtension: "json") else {
            throw CocoaError(.fileNoSuchFile)
        }
        let configuration = try JSONDecoder().decode(Self.self, from: Data(contentsOf: resource))
        let url = configuration.url
        guard url.scheme == "https", url.host?.isEmpty == false, url.user == nil, url.password == nil else {
            throw URLError(.badURL)
        }
        return url
    }
}
